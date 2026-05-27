const crypto = require("node:crypto");
const { LavalinkManager, NodeType, NodeLinkDefaultSources } = require("lavalink-client");
const config = require("../config");
const { logger } = require("./logger");
const { applyFilter } = require("./filters");
const { parseTime, serialTrack } = require("./format");
const {
    currentTrack,
    errorEmbed,
    filterMenu,
    nowPlayingEmbed,
    playerButtons,
    queueArray,
    queueButtons,
    queueEmbed,
    searchEmbed,
    searchMenu,
    simpleEmbed,
    softReply
} = require("./ui");

/**
 * @param {object} player
 * @param {string[]} names
 * @param {...unknown} args
 * @returns {Promise<unknown>}
 */
async function tryCall(player, names, ...args) {
    for (const name of names) {
        if (typeof player?.[name] === "function") {
            return player[name](...args);
        }
    }

    return null;
}

/**
 * @param {object} client
 * @returns {LavalinkManager}
 */
function createLavalink(client) {
    const manager = new LavalinkManager({
        nodes: [{
            id: config.lavalink.id,
            host: config.lavalink.host,
            port: config.lavalink.port,
            authorization: config.lavalink.authorization,
            secure: config.lavalink.secure,
            requestTimeout: config.lavalink.requestTimeout,
            nodeType: NodeType?.NodeLink || "nodelink",

            retryAmount: 999,
            retryDelay: 10000,
            closeOnError: false
        }],
        sendToShard: (guildId, payload) => client.guilds.cache.get(guildId)?.shard?.send(payload),
        autoSkip: true,
        client: {
            id: config.clientId,
            username: "Melody"
        },
        playerOptions: {
            clientBasedPositionUpdateInterval: 250,
            defaultSearchPlatform: "ytmsearch",
            volumeDecrementer: 0.75,
            requesterTransformer: (requester) => requester,
            onDisconnect: {
                autoReconnect: true,
                destroyPlayer: false
            },
            onEmptyQueue: {
                destroyAfterMs: 30_000
            }
        },
        queueOptions: {
            maxPreviousTracks: 40
        }
    });

    // NodeLink exposes a few extra source prefixes. This keeps normal
    // ytsearch/spotify/etc working while letting us opt into those later.
    if (NodeLinkDefaultSources) {
        manager.utils.SourcesRecord = NodeLinkDefaultSources;
    }

    return manager;
}

/**
 * @param {object} interaction
 * @returns {object}
 */
async function getPlayer(interaction) {
    const voice = interaction.member?.voice?.channel;
    if (!voice) throw new Error("Join a voice channel first.");

    const defaultVolume = interaction.client.db.getSetting(
        interaction.guildId,
        "defaultVolume",
        interaction.client.defaultVolume
    );

    const player = interaction.client.lavalink.createPlayer({
        guildId: interaction.guildId,
        voiceChannelId: voice.id,
        textChannelId: interaction.channelId,
        selfDeaf: true,
        selfMute: false,
        volume: Number(defaultVolume) || 70
    });

    if (!player.connected) {
        await player.connect();
    }

    return player;
}

/**
 * @param {object} player
 * @returns {Promise<void>}
 */
async function renderPanel(player) {
    const client = player.client || global.melodyClient;
    if (!client) return;

    const channelId = player.textChannelId;
    const channel = channelId ? await client.channels.fetch(channelId).catch(() => null) : null;
    if (!channel?.isTextBased?.()) return;

    const embed = nowPlayingEmbed(client.db, player);
    const components = playerButtons(player);
    const old = client.db.getPanel(player.guildId);

    if (old?.channel_id && old?.message_id) {
        const oldChannel = await client.channels.fetch(old.channel_id).catch(() => null);
        const message = await oldChannel?.messages?.fetch(old.message_id).catch(() => null);

        if (message) {
            await message.edit({ embeds: [embed], components }).catch(() => {});
            return;
        }
    }

    const sent = await channel.send({ embeds: [embed], components }).catch(() => null);
    if (sent) {
        client.db.savePanel(player.guildId, sent.channel.id, sent.id);
    }
}

/**
 * @param {object} interaction
 * @param {string} query
 * @param {boolean} searchOnly
 * @returns {Promise<void>}
 */
async function playQuery(interaction, query, searchOnly = false) {
    await interaction.deferReply();

    const player = await getPlayer(interaction);
    const result = await player.search({ query }, interaction.user);

    if (!result?.tracks?.length) {
        await interaction.editReply({
            embeds: [errorEmbed(interaction.client.db, interaction.guildId, "Nothing found", "Melody couldn't find a playable result for that query.")]
        });
        return;
    }

    if (searchOnly) {
        const token = crypto.randomBytes(8).toString("hex");
        interaction.client.pendingSearches.set(token, {
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            voiceChannelId: interaction.member.voice.channelId,
            userId: interaction.user.id,
            tracks: result.tracks.slice(0, 10),
            createdAt: Date.now()
        });

        await interaction.editReply({
            embeds: [searchEmbed(interaction.client.db, interaction.guildId, query, result.tracks)],
            components: searchMenu(token, result.tracks)
        });
        return;
    }

    const tracks = result.loadType === "playlist" ? result.tracks : [result.tracks[0]];
    const wasPlaying = Boolean(player.playing);

    await player.queue.add(tracks.length === 1 ? tracks[0] : tracks);

    if (!player.playing) {
        await player.play();
    }

    if (wasPlaying) {
        await renderPanel(player);
    }

    const suffix = tracks.length === 1
        ? `Added **${tracks[0].info?.title || "track"}** to the queue.`
        : `Added **${tracks.length} tracks** to the queue.`;

    await interaction.editReply({
        embeds: [simpleEmbed(interaction.client.db, interaction.guildId, "✅ Added", suffix)]
    });
}

/**
 * @param {object} interaction
 * @returns {Promise<void>}
 */
async function pauseToggle(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) return softReply(interaction, "Nothing is playing.");

    if (player.paused) {
        await tryCall(player, ["resume", "setPaused", "pause"], false);
    } else {
        await tryCall(player, ["pause", "setPaused"], true);
    }

    await renderPanel(player);
    await softReply(interaction, player.paused ? "Paused." : "Resumed.");
}

/**
 * @param {object} interaction
 * @returns {Promise<void>}
 */
async function skip(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) return softReply(interaction, "Nothing is playing.");

    await tryCall(player, ["skip", "stopPlaying", "stop"]);
    await renderPanel(player);
    await softReply(interaction, "Skipped.");
}

/**
 * @param {object} interaction
 * @returns {Promise<void>}
 */
async function previous(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) return softReply(interaction, "Nothing is playing.");

    const previousTracks = player.queue?.previous || player.queue?.previousTracks || [];
    const last = Array.isArray(previousTracks) ? previousTracks.at(-1) : null;

    if (!last) {
        return softReply(interaction, "No previous track available.");
    }

    await player.play(last);
    await renderPanel(player);
    await softReply(interaction, "Back to the previous track.");
}

/**
 * @param {object} interaction
 * @returns {Promise<void>}
 */
async function stop(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) return softReply(interaction, "Nothing is playing.");

    await tryCall(player, ["destroy", "disconnect"]);
    interaction.client.db.deletePanel(interaction.guildId);

    await softReply(interaction, "Stopped and left the voice channel.");
}

/**
 * @param {object} interaction
 * @param {number} volume
 * @returns {Promise<void>}
 */
async function setVolume(interaction, volume) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) return softReply(interaction, "Nothing is playing.");

    const safe = Math.max(1, Math.min(150, volume));
    await tryCall(player, ["setVolume", "volume"], safe);
    player.volume = safe;

    await renderPanel(player);
    await softReply(interaction, `Volume set to **${safe}%**.`);
}

/**
 * @param {object} interaction
 * @param {string} value
 * @returns {Promise<void>}
 */
async function seek(interaction, value) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) return softReply(interaction, "Nothing is playing.");

    const ms = parseTime(value);
    if (ms == null) return softReply(interaction, "Use a timestamp like `1:23`, `2:10`, or `360`.");

    await tryCall(player, ["seek"], ms);
    await renderPanel(player);
    await softReply(interaction, `Seeked to **${value}**.`);
}

/**
 * @param {object} interaction
 * @param {string} mode
 * @returns {Promise<void>}
 */
async function loop(interaction, mode) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) return softReply(interaction, "Nothing is playing.");

    const next = mode || (player.repeatMode === "queue" ? "off" : player.repeatMode === "track" ? "queue" : "track");

    await tryCall(player, ["setRepeatMode", "setLoop"], next);
    player.repeatMode = next;

    await renderPanel(player);
    await softReply(interaction, `Loop mode set to **${next}**.`);
}

/**
 * @param {object} interaction
 * @returns {Promise<void>}
 */
async function shuffle(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) return softReply(interaction, "Nothing is playing.");

    if (typeof player.queue?.shuffle === "function") {
        player.queue.shuffle();
    } else {
        const queue = queueArray(player);
        for (let i = queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [queue[i], queue[j]] = [queue[j], queue[i]];
        }
    }

    await renderPanel(player);
    await softReply(interaction, "Queue shuffled.");
}

/**
 * @param {object} interaction
 * @param {number} index
 * @returns {Promise<void>}
 */
async function remove(interaction, index) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) return softReply(interaction, "Nothing is playing.");

    const queue = queueArray(player);
    const at = index - 1;
    if (at < 0 || at >= queue.length) return softReply(interaction, "That queue position doesn't exist.");

    const removed = typeof player.queue?.remove === "function"
        ? player.queue.remove(at)
        : queue.splice(at, 1)[0];

    await renderPanel(player);
    await softReply(interaction, `Removed **${removed?.info?.title || removed?.title || "track"}**.`);
}

/**
 * @param {object} interaction
 * @param {number} from
 * @param {number} to
 * @returns {Promise<void>}
 */
async function move(interaction, from, to) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) return softReply(interaction, "Nothing is playing.");

    const queue = queueArray(player);
    const a = from - 1;
    const b = to - 1;

    if (a < 0 || a >= queue.length || b < 0 || b >= queue.length) {
        return softReply(interaction, "One of those queue positions doesn't exist.");
    }

    if (typeof player.queue?.move === "function") {
        player.queue.move(a, b);
    } else {
        const [item] = queue.splice(a, 1);
        queue.splice(b, 0, item);
    }

    await renderPanel(player);
    await softReply(interaction, `Moved track **${from}** to **${to}**.`);
}

/**
 * @param {object} interaction
 * @returns {Promise<void>}
 */
async function clear(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) return softReply(interaction, "Nothing is playing.");

    if (typeof player.queue?.clear === "function") {
        player.queue.clear();
    } else {
        const queue = queueArray(player);
        queue.splice(0, queue.length);
    }

    await renderPanel(player);
    await softReply(interaction, "Queue cleared.");
}

/**
 * @param {object} interaction
 * @param {number} page
 * @returns {Promise<void>}
 */
async function showQueue(interaction, page = 0) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) return softReply(interaction, "Nothing is playing.");

    const payload = {
        embeds: [queueEmbed(interaction.client.db, player, page)],
        components: queueButtons(page),
        ephemeral: true
    };

    if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload);
    } else {
        await interaction.reply(payload);
    }
}

/**
 * @param {object} interaction
 * @returns {Promise<void>}
 */
async function nowPlaying(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) return softReply(interaction, "Nothing is playing.");

    await interaction.reply({
        embeds: [nowPlayingEmbed(interaction.client.db, player)],
        components: playerButtons(player),
        ephemeral: false
    });
}

/**
 * @param {object} interaction
 * @param {string} key
 * @returns {Promise<void>}
 */
async function filter(interaction, key) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) return softReply(interaction, "Nothing is playing.");

    const label = await applyFilter(player, key);

    await renderPanel(player);
    await softReply(interaction, `Filter set to **${label}**.`);
}

/**
 * @param {object} interaction
 * @returns {Promise<void>}
 */
async function showFilters(interaction) {
    await interaction.reply({
        embeds: [simpleEmbed(interaction.client.db, interaction.guildId, "🎛 Filters", "Choose an audio preset below.")],
        components: filterMenu(),
        ephemeral: true
    });
}

/**
 * @param {object} interaction
 * @returns {Promise<void>}
 */
async function lyrics(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    const track = player ? currentTrack(player) : null;

    if (!track) return softReply(interaction, "Nothing is playing.");

    const title = track.info?.title || "this song";

    await interaction.reply({
        embeds: [
            simpleEmbed(
                interaction.client.db,
                interaction.guildId,
                "🎤 Lyrics",
                `Not implemented yet :o`
            )
        ],
        ephemeral: true
    });
}

/**
 * @param {object} interaction
 * @returns {Promise<void>}
 */
async function saveCurrent(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    const track = player ? currentTrack(player) : null;

    if (!track) return softReply(interaction, "Nothing is playing.");

    const name = "Liked Songs";
    let playlist = interaction.client.db.getPlaylist(null, interaction.user.id, "personal", name);

    if (!playlist) {
        playlist = interaction.client.db.createPlaylist(null, interaction.user.id, "personal", name);
    }

    const tracks = interaction.client.db.getPlaylistTracks(playlist.id);
    tracks.push(serialTrack(track));
    interaction.client.db.replacePlaylistTracks(playlist.id, tracks);

    await softReply(interaction, `Saved **${track.info?.title || "track"}** to **Liked Songs**.`);
}

/**
 * @param {object} client
 * @param {object} interaction
 * @returns {Promise<boolean>}
 */
async function handleComponent(client, interaction) {
    if (!interaction.customId?.startsWith("melody:")) return false;

    const id = interaction.customId;

    if (id.startsWith("melody:search:")) {
        const token = id.split(":")[2];
        const search = client.pendingSearches.get(token);
        const picked = Number(interaction.values?.[0] || 0);

        if (!search || search.guildId !== interaction.guildId) {
            await softReply(interaction, "That search expired.");
            return true;
        }

        const player = await getPlayer(interaction);
        await player.queue.add(search.tracks[picked]);

        if (!player.playing) {
            await player.play();
        }

        client.pendingSearches.delete(token);
        await renderPanel(player);

        await interaction.update({
            embeds: [simpleEmbed(client.db, interaction.guildId, "✅ Added", `Added **${search.tracks[picked].info?.title || "track"}** to the queue.`)],
            components: []
        });

        return true;
    }

    if (id === "melody:filter-select") {
        await filter(interaction, interaction.values[0]);
        return true;
    }

    if (id.startsWith("melody:qprev:")) {
        const page = Math.max(0, Number(id.split(":")[2] || 0) - 1);
        const player = client.lavalink.getPlayer(interaction.guildId);

        if (!player) return softReply(interaction, "Nothing is playing."), true;

        await interaction.update({
            embeds: [queueEmbed(client.db, player, page)],
            components: queueButtons(page)
        });
        return true;
    }

    if (id.startsWith("melody:qnext:")) {
        const page = Number(id.split(":")[2] || 0) + 1;
        const player = client.lavalink.getPlayer(interaction.guildId);

        if (!player) return softReply(interaction, "Nothing is playing."), true;

        await interaction.update({
            embeds: [queueEmbed(client.db, player, page)],
            components: queueButtons(page)
        });
        return true;
    }

    if (id === "melody:pause") await pauseToggle(interaction);
    else if (id === "melody:previous") await previous(interaction);
    else if (id === "melody:skip") await skip(interaction);
    else if (id === "melody:stop") await stop(interaction);
    else if (id === "melody:queue") await showQueue(interaction, 0);
    else if (id === "melody:shuffle") await shuffle(interaction);
    else if (id === "melody:loop") await loop(interaction);
    else if (id === "melody:filters") await showFilters(interaction);
    else if (id === "melody:clear") await clear(interaction);
    else if (id === "melody:save") await saveCurrent(interaction);
    else return false;

    return true;
}

/**
 * @param {unknown} error
 * @return {object}
 */
function cleanNodeError(error) {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: error.code
        };
    }

    if (error && typeof error === "object") {
        const out = {};

        for (const key of Object.getOwnPropertyNames(error)) {
            out[key] = error[key];
        }

        return Object.keys(out).length ? out : { raw: String(error) };
    }

    return { raw: String(error) };
}

/**
 * @param {object} node
 * @return {object}
 */
function cleanNode(node) {
    return {
        id: node?.id || node?.options?.id || "unknown",
        host: node?.options?.host,
        port: node?.options?.port,
        secure: node?.options?.secure,
        alive: Boolean(node?.isAlive),
        state: node?.reconnectionState || "unknown"
    };
}

/**
 * @param {object} client
 * @returns {void}
 */
function bindLavalinkEvents(client) {
    client.lavalink.nodeManager.on("create", (node) => {
        logger.info({ node: cleanNode(node) }, "NodeLink node created");
    });

    client.lavalink.nodeManager.on("connect", (node) => {
        logger.info({ node: cleanNode(node) }, "NodeLink node connected");
    });

    client.lavalink.nodeManager.on("disconnect", (node, reason) => {
        logger.warn({ node: cleanNode(node), reason }, "NodeLink node disconnected");
    });

    client.lavalink.nodeManager.on("reconnecting", (node) => {
        logger.warn({ node: cleanNode(node) }, "NodeLink node reconnecting");
    });

    client.lavalink.nodeManager.on("reconnectinprogress", (node) => {
        logger.warn({ node: cleanNode(node) }, "NodeLink node reconnect in progress");
    });

    client.lavalink.nodeManager.on("error", (node, error, payload) => {
        logger.error(
            {
                node: cleanNode(node),
                error: cleanNodeError(error),
                payload
            },
            "NodeLink node error"
        );
    });

    client.lavalink.nodeManager.on("destroy", (node) => {
        logger.warn({ node: cleanNode(node) }, "NodeLink node destroyed");
    });

    client.lavalink.on("trackStart", async (player, track) => {
        player.client = client;
        client.db.addHistory(player.guildId, track);
        await renderPanel(player);
    });

    client.lavalink.on("trackEnd", async (player) => {
        player.client = client;
        await renderPanel(player);
    });

    client.lavalink.on("trackError", async (player, track, payload) => {
        logger.warn({ guildId: player.guildId, track: track?.info?.title, payload }, "Track error");
        player.client = client;
        await renderPanel(player);
    });

    client.lavalink.on("trackStuck", async (player, track, payload) => {
        logger.warn({ guildId: player.guildId, track: track?.info?.title, payload }, "Track stuck");
        player.client = client;
        await renderPanel(player);
    });

    client.lavalink.on("queueEnd", async (player) => {
        player.client = client;
        await renderPanel(player);
    });
}

module.exports = {
    createLavalink,
    playQuery,
    pauseToggle,
    previous,
    skip,
    stop,
    setVolume,
    seek,
    loop,
    shuffle,
    remove,
    move,
    clear,
    showQueue,
    nowPlaying,
    filter,
    showFilters,
    lyrics,
    saveCurrent,
    renderPanel,
    handleComponent,
    bindLavalinkEvents
};
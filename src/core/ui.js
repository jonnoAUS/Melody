const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder
} = require("discord.js");
const {
    cut,
    progress,
    roughTime,
    time,
    trackArtwork,
    trackAuthor,
    trackLength,
    trackLine,
    trackSource,
    trackTitle,
    trackUri
} = require("./format");
const { allFilters } = require("./filters");

const COLORS = {
    neon: 0x9f7aea,
    midnight: 0x5865f2,
    rose: 0xeb459e,
    emerald: 0x57f287,
    amber: 0xfee75c,
    danger: 0xed4245,
    ok: 0x57f287
};

/**
 * @param {object} db
 * @param {string} guildId
 * @returns {number}
 */
function color(db, guildId) {
    const theme = db.getSetting(guildId, "theme", "neon");
    return COLORS[theme] || COLORS.neon;
}

/**
 * @param {object} interaction
 * @param {string} message
 * @returns {Promise<void>}
 */
async function softReply(interaction, message) {
    const payload = {
        embeds: [simpleEmbed(interaction.client.db, interaction.guildId, "Melody", message)],
        ephemeral: true
    };

    if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
    } else {
        await interaction.reply(payload).catch(() => {});
    }
}

/**
 * @param {object} db
 * @param {string} guildId
 * @param {string} title
 * @param {string} body
 * @returns {EmbedBuilder}
 */
function simpleEmbed(db, guildId, title, body) {
    return new EmbedBuilder()
        .setColor(color(db, guildId))
        .setTitle(title)
        .setDescription(body)
        .setTimestamp()
        .setFooter({ text: "Melody" });
}

/**
 * @param {object} db
 * @param {string} guildId
 * @param {string} title
 * @param {string} body
 * @returns {EmbedBuilder}
 */
function errorEmbed(db, guildId, title, body) {
    return new EmbedBuilder()
        .setColor(COLORS.danger)
        .setTitle(title)
        .setDescription(body)
        .setTimestamp()
        .setFooter({ text: "Melody" });
}

/**
 * @param {object} player
 * @returns {object[]}
 */
function queueArray(player) {
    const q = player?.queue;
    if (!q) return [];

    if (Array.isArray(q.tracks)) return q.tracks;
    if (Array.isArray(q.items)) return q.items;
    if (Array.isArray(q)) return q;
    if (typeof q.toArray === "function") return q.toArray();

    return [];
}

/**
 * @param {object} player
 * @returns {object | null}
 */
function currentTrack(player) {
    return player?.queue?.current || player?.current || null;
}

/**
 * @param {object} player
 * @returns {number}
 */
function queueLength(player) {
    return queueArray(player).length;
}

/**
 * @param {object} player
 * @returns {number}
 */
function queuedDuration(player) {
    return queueArray(player).reduce((sum, track) => sum + trackLength(track), 0);
}

/**
 * @param {object} db
 * @param {object} player
 * @returns {EmbedBuilder}
 */
function nowPlayingEmbed(db, player) {
    const current = currentTrack(player);
    const queue = queueArray(player);
    const position = Number(player.position || player.state?.position || 0);
    const volume = Number(player.volume || player.options?.volume || 0);
    const room = db.getRoom(player.guildId);

    const embed = new EmbedBuilder()
        .setColor(color(db, player.guildId))
        .setTitle(current ? "🎧 Now Playing" : "🎧 Melody")
        .setTimestamp()
        .setFooter({ text: "Melody" });

    if (!current) {
        return embed.setDescription("Nothing is playing right now.");
    }

    embed.setDescription([
        trackLine(current),
        "",
        progress(position, trackLength(current))
    ].join("\n"));

    const art = trackArtwork(current);
    if (art) embed.setThumbnail(art);

    embed.addFields(
        { name: "Queue", value: `${queue.length} waiting`, inline: true },
        { name: "Volume", value: volume ? `${volume}%` : "default", inline: true },
        { name: "Source", value: trackSource(current), inline: true },
        { name: "Track Length", value: time(trackLength(current)), inline: true },
        { name: "Queue Length", value: roughTime(queuedDuration(player)), inline: true },
        { name: "Mode", value: player.repeatMode || player.loop || "normal", inline: true }
    );

    if (room) {
        embed.addFields({
            name: "Vibe Room",
            value: `${room.locked ? "🔒" : "🔓"} ${room.theme} • hosted by <@${room.host_id}>`,
            inline: false
        });
    }

    return embed;
}

/**
 * @param {object} player
 * @returns {ActionRowBuilder[]}
 */
function playerButtons(player) {
    const paused = Boolean(player.paused);

    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("melody:previous")
                .setEmoji("⏮️")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId("melody:pause")
                .setEmoji(paused ? "▶️" : "⏸️")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("melody:skip")
                .setEmoji("⏭️")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("melody:stop")
                .setEmoji("⏹️")
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId("melody:queue")
                .setEmoji("📜")
                .setStyle(ButtonStyle.Secondary)
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("melody:shuffle")
                .setLabel("Shuffle")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId("melody:loop")
                .setLabel("Loop")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId("melody:filters")
                .setLabel("Filters")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId("melody:save")
                .setLabel("Save")
                .setStyle(ButtonStyle.Success)
        )
    ];
}

/**
 * @param {object} db
 * @param {object} player
 * @param {number} page
 * @returns {EmbedBuilder}
 */
function queueEmbed(db, player, page) {
    const queue = queueArray(player);
    const pageSize = 10;
    const pages = Math.max(1, Math.ceil(queue.length / pageSize));
    const safePage = Math.max(0, Math.min(page, pages - 1));
    const start = safePage * pageSize;
    const items = queue.slice(start, start + pageSize);

    const lines = items.map((track, i) => {
        const pos = start + i + 1;
        return `**${pos}.** ${trackLine(track)} \`${time(trackLength(track))}\``;
    });

    return new EmbedBuilder()
        .setColor(color(db, player.guildId))
        .setTitle("📜 Queue")
        .setDescription(lines.length ? lines.join("\n") : "The queue is empty.")
        .addFields(
            { name: "Page", value: `${safePage + 1}/${pages}`, inline: true },
            { name: "Waiting", value: `${queue.length}`, inline: true },
            { name: "Total", value: roughTime(queuedDuration(player)), inline: true }
        )
        .setTimestamp()
        .setFooter({ text: "Melody" });
}

/**
 * @param {number} page
 * @returns {ActionRowBuilder[]}
 */
function queueButtons(page) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`melody:qprev:${page}`)
                .setLabel("Previous")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`melody:qnext:${page}`)
                .setLabel("Next")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId("melody:shuffle")
                .setLabel("Shuffle")
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId("melody:clear")
                .setLabel("Clear")
                .setStyle(ButtonStyle.Danger)
        )
    ];
}

/**
 * @returns {ActionRowBuilder[]}
 */
function filterMenu() {
    const options = Object.entries(allFilters()).map(([key, filter]) => ({
        label: filter.label,
        value: key
    }));

    return [
        new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("melody:filter-select")
                .setPlaceholder("Pick an audio filter")
                .addOptions(options)
        )
    ];
}

/**
 * @param {string} token
 * @param {object[]} tracks
 * @returns {ActionRowBuilder[]}
 */
function searchMenu(token, tracks) {
    return [
        new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`melody:search:${token}`)
                .setPlaceholder("Choose a track")
                .addOptions(
                    tracks.slice(0, 10).map((track, index) => ({
                        label: cut(trackTitle(track), 90),
                        description: cut(`${trackAuthor(track)} • ${time(trackLength(track))}`, 95),
                        value: String(index)
                    }))
                )
        )
    ];
}

/**
 * @param {object} db
 * @param {string} guildId
 * @param {string} query
 * @param {object[]} tracks
 * @returns {EmbedBuilder}
 */
function searchEmbed(db, guildId, query, tracks) {
    const lines = tracks.slice(0, 10).map((track, i) => {
        return `**${i + 1}.** ${trackLine(track)} \`${time(trackLength(track))}\``;
    });

    return new EmbedBuilder()
        .setColor(color(db, guildId))
        .setTitle("🔎 Search Results")
        .setDescription(`Results for **${cut(query, 80)}**\n\n${lines.join("\n")}`)
        .setTimestamp()
        .setFooter({ text: "Melody" });
}

/**
 * @param {object} db
 * @param {string} guildId
 * @param {object} playlist
 * @param {object[]} tracks
 * @returns {EmbedBuilder}
 */
function playlistEmbed(db, guildId, playlist, tracks) {
    const lines = tracks.slice(0, 12).map((track, i) => {
        return `**${i + 1}.** ${trackUri(track) ? `[${cut(track.title, 60)}](${track.uri})` : cut(track.title, 60)} — ${cut(track.author, 32)}`;
    });

    return new EmbedBuilder()
        .setColor(color(db, guildId))
        .setTitle(`💿 ${playlist.name}`)
        .setDescription(lines.length ? lines.join("\n") : "This playlist is empty.")
        .addFields(
            { name: "Scope", value: playlist.scope, inline: true },
            { name: "Tracks", value: `${tracks.length}`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: "Melody" });
}

module.exports = {
    COLORS,
    color,
    softReply,
    simpleEmbed,
    errorEmbed,
    queueArray,
    currentTrack,
    queueLength,
    queuedDuration,
    nowPlayingEmbed,
    playerButtons,
    queueEmbed,
    queueButtons,
    filterMenu,
    searchMenu,
    searchEmbed,
    playlistEmbed
};
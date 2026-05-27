const { SlashCommandBuilder } = require("discord.js");
const { playQuery } = require("../core/music");
const {
    currentTrack,
    playlistEmbed,
    queueArray,
    simpleEmbed,
    softReply
} = require("../core/ui");
const { serialTrack } = require("../core/format");

/**
 * @param {import("discord.js").Interaction} interaction
 * @returns {string}
 */
function scope(interaction) {
    return interaction.options.getString("scope", false) || "personal";
}

/**
 * @param {import("discord.js").Interaction} interaction
 * @returns {string | null}
 */
function guildIdForScope(interaction) {
    return scope(interaction) === "server" ? interaction.guildId : null;
}

/**
 * @param {import("discord.js").Interaction} interaction
 * @returns {string}
 */
function ownerForScope(interaction) {
    return scope(interaction) === "server" ? interaction.guildId : interaction.user.id;
}

/**
 * @param {import("discord.js").Interaction} interaction
 * @param {string} name
 * @returns {object}
 */
function getOrCreate(interaction, name) {
    const db = interaction.client.db;
    const playlistScope = scope(interaction);
    const guildId = guildIdForScope(interaction);
    const ownerId = ownerForScope(interaction);

    return db.getPlaylist(guildId, ownerId, playlistScope, name)
        || db.createPlaylist(guildId, ownerId, playlistScope, name);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("playlist")
        .setDescription("Create, save, and play Melody playlists.")
        .addSubcommand((sub) =>
            sub
                .setName("create")
                .setDescription("Create a playlist.")
                .addStringOption((option) =>
                    option
                        .setName("name")
                        .setDescription("Playlist name.")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("scope")
                        .setDescription("Playlist scope.")
                        .setRequired(false)
                        .addChoices(
                            { name: "Personal", value: "personal" },
                            { name: "Server", value: "server" }
                        )
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("add-current")
                .setDescription("Add the current song to a playlist.")
                .addStringOption((option) =>
                    option
                        .setName("name")
                        .setDescription("Playlist name.")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("scope")
                        .setDescription("Playlist scope.")
                        .setRequired(false)
                        .addChoices(
                            { name: "Personal", value: "personal" },
                            { name: "Server", value: "server" }
                        )
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("save-queue")
                .setDescription("Save the current queue as a playlist.")
                .addStringOption((option) =>
                    option
                        .setName("name")
                        .setDescription("Playlist name.")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("scope")
                        .setDescription("Playlist scope.")
                        .setRequired(false)
                        .addChoices(
                            { name: "Personal", value: "personal" },
                            { name: "Server", value: "server" }
                        )
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("play")
                .setDescription("Play a saved playlist.")
                .addStringOption((option) =>
                    option
                        .setName("name")
                        .setDescription("Playlist name.")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("scope")
                        .setDescription("Playlist scope.")
                        .setRequired(false)
                        .addChoices(
                            { name: "Personal", value: "personal" },
                            { name: "Server", value: "server" }
                        )
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("view")
                .setDescription("View a playlist.")
                .addStringOption((option) =>
                    option
                        .setName("name")
                        .setDescription("Playlist name.")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("scope")
                        .setDescription("Playlist scope.")
                        .setRequired(false)
                        .addChoices(
                            { name: "Personal", value: "personal" },
                            { name: "Server", value: "server" }
                        )
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("list")
                .setDescription("List your playlists.")
                .addStringOption((option) =>
                    option
                        .setName("scope")
                        .setDescription("Playlist scope.")
                        .setRequired(false)
                        .addChoices(
                            { name: "Personal", value: "personal" },
                            { name: "Server", value: "server" }
                        )
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("delete")
                .setDescription("Delete a playlist.")
                .addStringOption((option) =>
                    option
                        .setName("name")
                        .setDescription("Playlist name.")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("scope")
                        .setDescription("Playlist scope.")
                        .setRequired(false)
                        .addChoices(
                            { name: "Personal", value: "personal" },
                            { name: "Server", value: "server" }
                        )
                )
        ),

    /**
     * @param {import("discord.js").Interaction} interaction
     * @returns {Promise<void>}
     */
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const db = interaction.client.db;
        const name = interaction.options.getString("name", false);
        const playlistScope = scope(interaction);
        const guildId = guildIdForScope(interaction);
        const ownerId = ownerForScope(interaction);

        if (sub === "create") {
            if (db.getPlaylist(guildId, ownerId, playlistScope, name)) {
                return softReply(interaction, "That playlist already exists.");
            }

            const playlist = db.createPlaylist(guildId, ownerId, playlistScope, name);

            return interaction.reply({
                embeds: [simpleEmbed(db, interaction.guildId, "💿 Playlist Created", `Created **${playlist.name}** as a **${playlist.scope}** playlist.`)],
                ephemeral: true
            });
        }

        if (sub === "add-current") {
            const player = interaction.client.lavalink.getPlayer(interaction.guildId);
            const track = player ? currentTrack(player) : null;
            if (!track) return softReply(interaction, "Nothing is playing.");

            const playlist = getOrCreate(interaction, name);
            const tracks = db.getPlaylistTracks(playlist.id);
            tracks.push(serialTrack(track));
            db.replacePlaylistTracks(playlist.id, tracks);

            return interaction.reply({
                embeds: [simpleEmbed(db, interaction.guildId, "✅ Saved", `Added **${track.info?.title || "track"}** to **${playlist.name}**.`)],
                ephemeral: true
            });
        }

        if (sub === "save-queue") {
            const player = interaction.client.lavalink.getPlayer(interaction.guildId);
            if (!player) return softReply(interaction, "Nothing is playing.");

            const tracks = [currentTrack(player), ...queueArray(player)].filter(Boolean);
            if (!tracks.length) return softReply(interaction, "There is nothing to save.");

            const playlist = getOrCreate(interaction, name);
            db.replacePlaylistTracks(playlist.id, tracks);

            return interaction.reply({
                embeds: [simpleEmbed(db, interaction.guildId, "💿 Queue Saved", `Saved **${tracks.length} tracks** to **${playlist.name}**.`)],
                ephemeral: true
            });
        }

        if (sub === "play") {
            const playlist = db.getPlaylist(guildId, ownerId, playlistScope, name);
            if (!playlist) return softReply(interaction, "That playlist doesn't exist.");

            const tracks = db.getPlaylistTracks(playlist.id);
            if (!tracks.length) return softReply(interaction, "That playlist is empty.");

            await interaction.deferReply();

            for (const track of tracks.slice(0, 50)) {
                const query = track.uri || `${track.title} ${track.author}`;
                await playQuery(interaction, query, false);
                return;
            }
        }

        if (sub === "view") {
            const playlist = db.getPlaylist(guildId, ownerId, playlistScope, name);
            if (!playlist) return softReply(interaction, "That playlist doesn't exist.");

            const tracks = db.getPlaylistTracks(playlist.id);

            return interaction.reply({
                embeds: [playlistEmbed(db, interaction.guildId, playlist, tracks)],
                ephemeral: true
            });
        }

        if (sub === "list") {
            const playlists = playlistScope === "server"
                ? db.listServerPlaylists(interaction.guildId)
                : db.listUserPlaylists(null, interaction.user.id, "personal");

            const lines = playlists.map((playlist, index) => {
                return `**${index + 1}.** ${playlist.name} • ${playlist.scope}`;
            });

            return interaction.reply({
                embeds: [simpleEmbed(db, interaction.guildId, "💿 Playlists", lines.length ? lines.join("\n") : "No playlists yet.")],
                ephemeral: true
            });
        }

        if (sub === "delete") {
            const playlist = db.getPlaylist(guildId, ownerId, playlistScope, name);
            if (!playlist) return softReply(interaction, "That playlist doesn't exist.");

            db.deletePlaylist(playlist.id);

            return interaction.reply({
                embeds: [simpleEmbed(db, interaction.guildId, "🗑 Playlist Deleted", `Deleted **${playlist.name}**.`)],
                ephemeral: true
            });
        }
    }
};
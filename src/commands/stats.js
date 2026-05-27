const { SlashCommandBuilder } = require("discord.js");
const { roughTime } = require("../core/format");
const { simpleEmbed } = require("../core/ui");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stats")
        .setDescription("View Melody listening stats.")
        .addSubcommand((sub) => sub.setName("me").setDescription("Show your listening stats."))
        .addSubcommand((sub) => sub.setName("server").setDescription("Show server listening stats."))
        .addSubcommand((sub) => sub.setName("top").setDescription("Show top tracks and listeners."))
        .addSubcommand((sub) => sub.setName("wrapped").setDescription("Show a server wrapped-style recap.")),

    /**
     * @param {object} interaction
     * @return {Promise<void>}
     */
    async execute(interaction) {
        const db = interaction.client.db;
        const sub = interaction.options.getSubcommand();

        if (sub === "me") {
            const stats = db.userStats(interaction.guildId, interaction.user.id);

            return interaction.reply({
                embeds: [
                    simpleEmbed(
                        db,
                        interaction.guildId,
                        "🎧 Your Melody Stats",
                        [
                            `Tracks played: **${stats.plays || 0}**`,
                            `Listening time: **${roughTime(stats.length_ms || 0)}**`
                        ].join("\n")
                    )
                ],
                ephemeral: true
            });
        }

        if (sub === "server") {
            const stats = db.guildStats(interaction.guildId);

            return interaction.reply({
                embeds: [
                    simpleEmbed(
                        db,
                        interaction.guildId,
                        "📊 Server Melody Stats",
                        [
                            `Tracks played: **${stats.plays || 0}**`,
                            `Total listening time: **${roughTime(stats.length_ms || 0)}**`
                        ].join("\n")
                    )
                ]
            });
        }

        if (sub === "top") {
            const tracks = db.topTracks(interaction.guildId, 8);
            const users = db.topUsers(interaction.guildId, 5);

            const trackLines = tracks.map((track, index) => {
                return `**${index + 1}.** ${track.title} — ${track.author} • ${track.count} plays`;
            });

            const userLines = users.map((user, index) => {
                return `**${index + 1}.** <@${user.user_id}> • ${user.count} plays`;
            });

            return interaction.reply({
                embeds: [
                    simpleEmbed(
                        db,
                        interaction.guildId,
                        "🏆 Top Music Stats",
                        [
                            "**Top Tracks**",
                            trackLines.length ? trackLines.join("\n") : "No tracks yet.",
                            "",
                            "**Top Listeners**",
                            userLines.length ? userLines.join("\n") : "No listeners yet."
                        ].join("\n")
                    )
                ]
            });
        }

        if (sub === "wrapped") {
            const tracks = db.topTracks(interaction.guildId, 5);
            const stats = db.guildStats(interaction.guildId);

            const lines = tracks.map((track, index) => {
                return `**${index + 1}.** ${track.title} — ${track.author}`;
            });

            return interaction.reply({
                embeds: [
                    simpleEmbed(
                        db,
                        interaction.guildId,
                        "✨ Server Wrapped",
                        [
                            `This server played **${stats.plays || 0} tracks** through Melody.`,
                            `Total listening time: **${roughTime(stats.length_ms || 0)}**`,
                            "",
                            "**Most played tracks**",
                            lines.length ? lines.join("\n") : "Not enough data yet."
                        ].join("\n")
                    )
                ]
            });
        }
    }
};
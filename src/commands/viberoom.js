const { SlashCommandBuilder } = require("discord.js");
const { roughTime } = require("../core/format");
const { simpleEmbed, softReply } = require("../core/ui");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("viberoom")
        .setDescription("Create collaborative listening sessions.")
        .addSubcommand((sub) =>
            sub
                .setName("start")
                .setDescription("Start a Vibe Room.")
                .addStringOption((option) =>
                    option
                        .setName("theme")
                        .setDescription("Room theme.")
                        .setRequired(false)
                        .addChoices(
                            { name: "Night Drive", value: "night-drive" },
                            { name: "Neon Lounge", value: "neon-lounge" },
                            { name: "Gym Mode", value: "gym" },
                            { name: "Chill Study", value: "study" },
                            { name: "Chaos Queue", value: "chaos" }
                        )
                )
        )
        .addSubcommand((sub) => sub.setName("end").setDescription("End the active Vibe Room."))
        .addSubcommand((sub) =>
            sub
                .setName("lock")
                .setDescription("Lock or unlock the Vibe Room.")
                .addBooleanOption((option) =>
                    option
                        .setName("locked")
                        .setDescription("Locked state.")
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("theme")
                .setDescription("Change the Vibe Room theme.")
                .addStringOption((option) =>
                    option
                        .setName("name")
                        .setDescription("Theme name.")
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) => sub.setName("recap").setDescription("Show the current room recap.")),

    /**
     * @param {object} interaction
     * @return {Promise<void>}
     */
    async execute(interaction) {
        const db = interaction.client.db;
        const sub = interaction.options.getSubcommand();

        if (sub === "start") {
            const theme = interaction.options.getString("theme", false) || "neon-lounge";
            const room = db.startRoom(interaction.guildId, interaction.user.id, theme);

            return interaction.reply({
                embeds: [
                    simpleEmbed(
                        db,
                        interaction.guildId,
                        "🌙 Vibe Room Started",
                        [
                            `Theme: **${room.theme}**`,
                            `Host: <@${room.host_id}>`,
                            "Melody will show this room on the player panel while it is active."
                        ].join("\n")
                    )
                ]
            });
        }

        if (sub === "end") {
            const room = db.getRoom(interaction.guildId);
            if (!room) return softReply(interaction, "There is no active Vibe Room.");

            db.endRoom(interaction.guildId);

            return interaction.reply({
                embeds: [
                    simpleEmbed(
                        db,
                        interaction.guildId,
                        "🌘 Vibe Room Ended",
                        [
                            `Theme: **${room.theme}**`,
                            `Duration: **${roughTime(Date.now() - room.started_at)}**`,
                            `Host: <@${room.host_id}>`
                        ].join("\n")
                    )
                ]
            });
        }

        if (sub === "lock") {
            const room = db.getRoom(interaction.guildId);
            if (!room) return softReply(interaction, "There is no active Vibe Room.");

            const locked = interaction.options.getBoolean("locked", true);
            db.updateRoom(interaction.guildId, room.theme, locked);

            return interaction.reply({
                embeds: [simpleEmbed(db, interaction.guildId, "🔒 Vibe Room", `Room is now **${locked ? "locked" : "unlocked"}**.`)],
                ephemeral: true
            });
        }

        if (sub === "theme") {
            const room = db.getRoom(interaction.guildId);
            if (!room) return softReply(interaction, "There is no active Vibe Room.");

            const theme = interaction.options.getString("name", true);
            db.updateRoom(interaction.guildId, theme, Boolean(room.locked));

            return interaction.reply({
                embeds: [simpleEmbed(db, interaction.guildId, "🌙 Theme Updated", `Vibe Room theme set to **${theme}**.`)],
                ephemeral: true
            });
        }

        if (sub === "recap") {
            const room = db.getRoom(interaction.guildId);
            if (!room) return softReply(interaction, "There is no active Vibe Room.");

            const stats = db.guildStats(interaction.guildId);

            return interaction.reply({
                embeds: [
                    simpleEmbed(
                        db,
                        interaction.guildId,
                        "✨ Vibe Room Recap",
                        [
                            `Theme: **${room.theme}**`,
                            `Host: <@${room.host_id}>`,
                            `Duration: **${roughTime(Date.now() - room.started_at)}**`,
                            `Server plays recorded: **${stats.plays || 0}**`
                        ].join("\n")
                    )
                ]
            });
        }
    }
};
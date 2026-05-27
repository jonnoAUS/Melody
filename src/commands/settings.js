const { PermissionFlagsBits, SlashCommandBuilder } = require("discord.js");
const { simpleEmbed } = require("../core/ui");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("settings")
        .setDescription("Configure Melody for this server.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand((sub) =>
            sub
                .setName("dj-role")
                .setDescription("Set the DJ role.")
                .addRoleOption((option) =>
                    option
                        .setName("role")
                        .setDescription("DJ role.")
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("vote-skip")
                .setDescription("Set vote skip percentage.")
                .addIntegerOption((option) =>
                    option
                        .setName("percent")
                        .setDescription("Percentage required.")
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("default-volume")
                .setDescription("Set default volume.")
                .addIntegerOption((option) =>
                    option
                        .setName("amount")
                        .setDescription("1 to 150.")
                        .setMinValue(1)
                        .setMaxValue(150)
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("max-user-queue")
                .setDescription("Set max queue entries per user.")
                .addIntegerOption((option) =>
                    option
                        .setName("amount")
                        .setDescription("Max tracks per user.")
                        .setMinValue(1)
                        .setMaxValue(100)
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("announce-channel")
                .setDescription("Set the channel Melody uses for music panels.")
                .addChannelOption((option) =>
                    option
                        .setName("channel")
                        .setDescription("Text channel.")
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("theme")
                .setDescription("Set Melody's embed theme.")
                .addStringOption((option) =>
                    option
                        .setName("name")
                        .setDescription("Theme.")
                        .setRequired(true)
                        .addChoices(
                            { name: "Neon", value: "neon" },
                            { name: "Midnight", value: "midnight" },
                            { name: "Rose", value: "rose" },
                            { name: "Emerald", value: "emerald" },
                            { name: "Amber", value: "amber" }
                        )
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("twenty-four-seven")
                .setDescription("Keep Melody in voice when the queue ends.")
                .addBooleanOption((option) =>
                    option
                    .setName("enabled")
                    .setDescription("Enabled.")
                    .setRequired(true)
                )
        ),

    /**
     * @param {import("discord.js").Interaction} interaction
     * @returns {Promise<void>}
     */
    async execute(interaction) {
        const db = interaction.client.db;
        const sub = interaction.options.getSubcommand();

        let label;
        let value;

        if (sub === "dj-role") {
            const role = interaction.options.getRole("role", true);
            label = "DJ Role";
            value = `<@&${role.id}>`;
            db.setSetting(interaction.guildId, "djRole", role.id);
        }

        if (sub === "vote-skip") {
            value = interaction.options.getInteger("percent", true);
            label = "Vote Skip";
            db.setSetting(interaction.guildId, "voteSkip", value);
        }

        if (sub === "default-volume") {
            value = interaction.options.getInteger("amount", true);
            label = "Default Volume";
            db.setSetting(interaction.guildId, "defaultVolume", value);
        }

        if (sub === "max-user-queue") {
            value = interaction.options.getInteger("amount", true);
            label = "Max User Queue";
            db.setSetting(interaction.guildId, "maxUserQueue", value);
        }

        if (sub === "announce-channel") {
            const channel = interaction.options.getChannel("channel", true);
            value = `<#${channel.id}>`;
            label = "Announce Channel";
            db.setSetting(interaction.guildId, "announceChannel", channel.id);
        }

        if (sub === "theme") {
            value = interaction.options.getString("name", true);
            label = "Theme";
            db.setSetting(interaction.guildId, "theme", value);
        }

        if (sub === "twenty-four-seven") {
            value = interaction.options.getBoolean("enabled", true);
            label = "24/7 Mode";
            db.setSetting(interaction.guildId, "twentyFourSeven", value);
        }

        await interaction.reply({
            embeds: [simpleEmbed(db, interaction.guildId, "⚙ Setting Updated", `**${label}** set to **${value}**.`)],
            ephemeral: true
        });
    }
};
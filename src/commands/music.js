const { SlashCommandBuilder } = require("discord.js");
const {
    clear,
    filter,
    lyrics,
    loop,
    move,
    nowPlaying,
    pauseToggle,
    playQuery,
    remove,
    seek,
    setVolume,
    showFilters,
    showQueue,
    shuffle,
    skip,
    stop
} = require("../core/music");
const { simpleEmbed } = require("../core/ui");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("music")
        .setDescription("Melody music controls.")
        .addSubcommand((sub) =>
            sub
                .setName("play")
                .setDescription("Play a song or playlist.")
                .addStringOption((option) =>
                    option
                        .setName("query")
                        .setDescription("Song name or URL.")
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("search")
                .setDescription("Search and pick a song.")
                .addStringOption((option) =>
                    option
                        .setName("query")
                        .setDescription("Song name.")
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) => sub.setName("pause").setDescription("Pause or resume the player."))
        .addSubcommand((sub) => sub.setName("resume").setDescription("Resume the player."))
        .addSubcommand((sub) => sub.setName("skip").setDescription("Skip the current song."))
        .addSubcommand((sub) => sub.setName("stop").setDescription("Stop music and leave voice."))
        .addSubcommand((sub) => sub.setName("queue").setDescription("Show the queue."))
        .addSubcommand((sub) => sub.setName("nowplaying").setDescription("Show the current player panel."))
        .addSubcommand((sub) =>
            sub
                .setName("volume")
                .setDescription("Change volume.")
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
                .setName("seek")
                .setDescription("Seek to a timestamp.")
                .addStringOption((option) =>
                    option
                        .setName("time")
                        .setDescription("Example: 1:23, 2:10, 360.")
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("loop")
                .setDescription("Set loop mode.")
                .addStringOption((option) =>
                    option
                        .setName("mode")
                        .setDescription("Loop mode.")
                        .setRequired(false)
                        .addChoices(
                            { name: "Off", value: "off" },
                            { name: "Track", value: "track" },
                            { name: "Queue", value: "queue" }
                        )
                )
        )
        .addSubcommand((sub) => sub.setName("shuffle").setDescription("Shuffle the queue."))
        .addSubcommand((sub) => sub.setName("clear").setDescription("Clear the queue."))
        .addSubcommand((sub) =>
            sub
                .setName("remove")
                .setDescription("Remove a queued song.")
                .addIntegerOption((option) =>
                    option
                        .setName("position")
                        .setDescription("Queue position.")
                        .setMinValue(1)
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("move")
                .setDescription("Move a queued song.")
                .addIntegerOption((option) =>
                    option
                        .setName("from")
                        .setDescription("Current queue position.")
                        .setMinValue(1)
                        .setRequired(true)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("to")
                        .setDescription("New queue position.")
                        .setMinValue(1)
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("filters")
                .setDescription("Apply an audio filter.")
                .addStringOption((option) =>
                    option
                        .setName("preset")
                        .setDescription("Filter preset.")
                        .setRequired(false)
                        .addChoices(
                            { name: "Off", value: "off" },
                            { name: "Bass Boost", value: "bass" },
                            { name: "Nightcore", value: "nightcore" },
                            { name: "Vaporwave", value: "vaporwave" },
                            { name: "Lo-fi Room", value: "lofi" },
                            { name: "Karaoke", value: "karaoke" },
                            { name: "8D", value: "eightd" },
                            { name: "Tremolo", value: "tremolo" }
                        )
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("autoplay")
                .setDescription("Enable or disable autoplay.")
                .addStringOption((option) =>
                    option
                        .setName("mode")
                        .setDescription("Autoplay mode.")
                        .setRequired(true)
                        .addChoices(
                            { name: "Off", value: "off" },
                            { name: "Similar", value: "similar" },
                            { name: "Server Vibe", value: "server" }
                        )
                )
        )
        .addSubcommand((sub) => sub.setName("lyrics").setDescription("Show lyrics for the current song.")),

    /**
     * @param {import("discord.js").Interaction} interaction
     * @returns {Promise<void>}
     */
    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === "play") {
            return playQuery(interaction, interaction.options.getString("query", true), false);
        }

        if (sub === "search") {
            return playQuery(interaction, interaction.options.getString("query", true), true);
        }

        if (sub === "pause" || sub === "resume") return pauseToggle(interaction);
        if (sub === "skip") return skip(interaction);
        if (sub === "stop") return stop(interaction);
        if (sub === "queue") return showQueue(interaction, 0);
        if (sub === "nowplaying") return nowPlaying(interaction);
        if (sub === "volume") return setVolume(interaction, interaction.options.getInteger("amount", true));
        if (sub === "seek") return seek(interaction, interaction.options.getString("time", true));
        if (sub === "loop") return loop(interaction, interaction.options.getString("mode", false));
        if (sub === "shuffle") return shuffle(interaction);
        if (sub === "clear") return clear(interaction);
        if (sub === "remove") return remove(interaction, interaction.options.getInteger("position", true));
        if (sub === "move") {
            return move(
                interaction,
                interaction.options.getInteger("from", true),
                interaction.options.getInteger("to", true)
            );
        }

        if (sub === "filters") {
            const preset = interaction.options.getString("preset", false);
            return preset ? filter(interaction, preset) : showFilters(interaction);
        }

        if (sub === "autoplay") {
            const mode = interaction.options.getString("mode", true);
            interaction.client.db.setSetting(interaction.guildId, "autoplay", mode);

            return interaction.reply({
                embeds: [simpleEmbed(interaction.client.db, interaction.guildId, "✨ Autoplay", `Autoplay set to **${mode}**.`)],
                ephemeral: true
            });
        }

        if (sub === "lyrics") return lyrics(interaction);
    }
};
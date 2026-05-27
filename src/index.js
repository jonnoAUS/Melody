const fs = require("node:fs");
const path = require("node:path");
const { Client, Collection, Events, GatewayIntentBits, Partials, ActivityType } = require("discord.js");
const config = require("./config");
const { createDatabase } = require("./core/db");
const { logger } = require("./core/logger");
const { createLavalink, bindLavalinkEvents, handleComponent } = require("./core/music");

/**
 * @param {unknown} error
 * @return {object}
 */
function cleanError(error) {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: error.code,
            cause: error.cause
        };
    }

    if (typeof error === "object" && error !== null) {
        const out = {};

        for (const key of Object.getOwnPropertyNames(error)) {
            out[key] = error[key];
        }

        return Object.keys(out).length ? out : { raw: String(error) };
    }

    return {
        raw: String(error)
    };
}

/**
 * @param {Client} client
 * @return {void}
 */
function loadCommands(client) {
    const commandPath = path.join(__dirname, "commands");

    for (const file of fs.readdirSync(commandPath).filter((name) => name.endsWith(".js"))) {
        const command = require(path.join(commandPath, file));

        if (!command?.data?.name || typeof command.execute !== "function") {
            logger.warn({ file }, "Skipped invalid command");
            continue;
        }

        client.commands.set(command.data.name, command);
    }
}

/**
 * @return {Client}
 */
function createClient() {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildMessages
        ],
        partials: [Partials.Channel]
    });

    client.commands = new Collection();
    client.pendingSearches = new Map();
    client.voteSkips = new Map();
    client.defaultVolume = config.defaultVolume;
    client.db = createDatabase(config.dataPath);
    client.lavalink = createLavalink(client);

    global.melodyClient = client;

    loadCommands(client);
    bindLavalinkEvents(client);

    client.on("raw", (data) => {
        client.lavalink.sendRawData(data);
    });

    client.once(Events.ClientReady, async () => {
        logger.info({ tag: client.user.tag, id: client.user.id }, "Melody online");

        try {
            await client.lavalink.init({ ...client.user });

            logger.info("Lavalink client initialized");
        } catch (error) {
            logger.error({ error: cleanError(error) }, "Lavalink init failed");
        }

        client.user.setPresence({
            activities: [{ name: "/music play", type: ActivityType.Listening }],
            status: "online"
        });
    });

    client.on(Events.InteractionCreate, async (interaction) => {
        try {
            if (interaction.isButton() || interaction.isStringSelectMenu()) {
                if (await handleComponent(client, interaction)) return;
            }

            if (!interaction.isChatInputCommand()) return;

            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            await command.execute(interaction);
        } catch (error) {
            logger.error({ error: cleanError(error) }, "Interaction failed");

            const payload = {
                content: "Melody hit an internal error while handling that.",
                ephemeral: true
            };

            if (interaction.deferred || interaction.replied) {
                await interaction.followUp(payload).catch(() => {});
            } else {
                await interaction.reply(payload).catch(() => {});
            }
        }
    });

    return client;
}

if (!config.token || !config.clientId) {
    logger.fatal("Missing DISCORD_TOKEN or DISCORD_CLIENT_ID");
    process.exit(1);
}

const client = createClient();

process.on("unhandledRejection", (error) => {
    logger.error({ error: cleanError(error) }, "Unhandled rejection");
});

process.on("uncaughtException", (error) => {
    logger.fatal({ error: cleanError(error) }, "Uncaught exception");
    process.exit(1);
});

client.login(config.token).catch((error) => {
    logger.fatal({ error: cleanError(error) }, "Discord login failed");
    process.exit(1);
});
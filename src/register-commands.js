const fs = require("node:fs");
const path = require("node:path");
const { REST, Routes } = require("discord.js");
const config = require("./config");
const { logger } = require("./core/logger");

/**
 * @return {object[]}
 */
function collectCommands() {
    const commands = [];
    const commandPath = path.join(__dirname, "commands");

    for (const file of fs.readdirSync(commandPath).filter((name) => name.endsWith(".js"))) {
        const command = require(path.join(commandPath, file));
        if (command?.data?.toJSON) {
            commands.push(command.data.toJSON());
        }
    }

    return commands;
}

(async () => {
    if (!config.token || !config.clientId) {
        logger.fatal("Missing DISCORD_TOKEN or DISCORD_CLIENT_ID");
        process.exit(1);
    }

    const commands = collectCommands();
    const rest = new REST({ version: "10" }).setToken(config.token);

    const route = config.guildId
        ? Routes.applicationGuildCommands(config.clientId, config.guildId)
        : Routes.applicationCommands(config.clientId);

    logger.info({ count: commands.length, guild: config.guildId || "global" }, "Registering commands");

    await rest.put(route, { body: commands });

    logger.info("Commands registered");
})().catch((error) => {
    logger.fatal({ error }, "Failed to register commands");
    process.exit(1);
});
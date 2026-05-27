const path = require("node:path");
const { ShardingManager } = require("discord.js");
const config = require("./config");
const { logger } = require("./core/logger");

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

    return { raw: String(error) };
}

if (!config.token) {
    logger.fatal("Missing DISCORD_TOKEN");
    process.exit(1);
}

const manager = new ShardingManager(path.join(__dirname, "index.js"), {
    token: config.token,
    totalShards: "auto",
    respawn: true
});

manager.on("shardCreate", (shard) => {
    logger.info({ shardId: shard.id }, "Launching shard");

    shard.on("ready", () => {
        logger.info({ shardId: shard.id }, "Shard ready");
    });

    shard.on("death", (process) => {
        logger.warn(
            {
                shardId: shard.id,
                exitCode: process.exitCode,
                signalCode: process.signalCode
            },
            "Shard died"
        );
    });

    shard.on("error", (error) => {
        logger.error({ shardId: shard.id, error: cleanError(error) }, "Shard error");
    });
});

manager.spawn().catch((error) => {
    logger.fatal({ error: cleanError(error) }, "Failed to spawn shards");
    process.exit(1);
});
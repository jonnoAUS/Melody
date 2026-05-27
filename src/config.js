require("dotenv").config();

/**
 * @param {string | undefined} value
 * @param {boolean} fallback
 * @returns {boolean}
 */
function bool(value, fallback) {
    if (value == null || value === "") return fallback;
    return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

/**
 * @param {string | undefined} value
 * @param {number} fallback
 * @returns {number}
 */
function int(value, fallback) {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * @param {string[]} names
 * @returns {string | undefined}
 */
function firstEnv(names) {
    for (const name of names) {
        const value = process.env[name];
        if (value != null && value !== "") return value;
    }

    return undefined;
}

module.exports = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID || null,

    defaultVolume: Math.max(1, Math.min(150, int(process.env.DEFAULT_VOLUME, 70))),
    dataPath: process.env.DATA_PATH || "./data/melody.sqlite",
    logLevel: process.env.LOG_LEVEL || "info",

    // Kept as `lavalink` so the rest of the bot does not need a dumb rename pass.
    // The actual server behind it is NodeLink.
    lavalink: {
        id: firstEnv(["NODELINK_NODE_ID", "LAVALINK_NODE_ID"]) || "melody-nodelink",
        host: firstEnv(["NODELINK_HOST", "LAVALINK_HOST"]) || "nodelink",
        port: int(firstEnv(["NODELINK_PORT", "LAVALINK_PORT"]), 2333),
        authorization: firstEnv(["NODELINK_PASSWORD", "LAVALINK_PASSWORD"]) || "youshallnotpass",
        secure: bool(firstEnv(["NODELINK_SECURE", "LAVALINK_SECURE"]), false),
        requestTimeout: int(process.env.NODELINK_REQUEST_TIMEOUT, 15000)
    }
};

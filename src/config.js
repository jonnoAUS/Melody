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

    nodelink: {
        id: "melody-nodelink",
        host: process.env.NODELINK_HOST || "nodelink",
        port: int(process.env.NODELINK_PORT, 2333),
        authorization: process.env.NODELINK_PASSWORD || "change-this-password",
        secure: bool(process.env.NODELINK_SECURE, false),
        requestTimeout: 15000
    }
};
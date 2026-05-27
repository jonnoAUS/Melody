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

module.exports = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID || null,

    defaultVolume: Math.max(1, Math.min(150, int(process.env.DEFAULT_VOLUME, 70))),
    dataPath: process.env.DATA_PATH || "./data/melody.sqlite",
    logLevel: process.env.LOG_LEVEL || "info",

    lavalink: {
        id: "melody-main",
        host: process.env.LAVALINK_HOST || "127.0.0.1",
        port: int(process.env.LAVALINK_PORT, 2333),
        authorization: process.env.LAVALINK_PASSWORD || "notgettingmypassworddickhead",
        secure: bool(process.env.LAVALINK_SECURE, false),
        requestTimeout: 15000
    }
};
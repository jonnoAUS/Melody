const pino = require("pino");
const config = require("../config.js");

const logger = pino({
    level: config.logLevel,
    transport: process.stdout.isTTY
        ? {
            target: "pino-pretty",
            options: {
                colorize: true,
                translateTime: "SYS:standard"
            }
        }
        : undefined
});

module.exports = { logger };
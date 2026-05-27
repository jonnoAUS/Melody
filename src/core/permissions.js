const { PermissionFlagsBits } = require("discord.js");

/**
 * @param {object} interaction
 * @returns {boolean}
 */
function isManager(interaction) {
    return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
}

/**
 * @param {object} interaction
 * @returns {boolean}
 */
function hasDjRole(interaction) {
    const roleId = interaction.client.db.getSetting(interaction.guildId, "djRole", null);
    if (!roleId) return false;
    return Boolean(interaction.member?.roles?.cache?.has(roleId));
}

/**
 * @param {object} interaction
 * @returns {boolean}
 */
function canControl(interaction) {
    return isManager(interaction) || hasDjRole(interaction);
}

/**
 * @param {object} interaction
 * @returns {boolean}
 */
function sameVoice(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    const userChannel = interaction.member?.voice?.channelId;

    if (!player || !userChannel) return false;
    if (!player.voiceChannelId) return true;

    return player.voiceChannelId === userChannel;
}

/**
 * @param {object} interaction
 * @returns {string | null}
 */
function voiceProblem(interaction) {
    const userChannel = interaction.member?.voice?.channel;
    if (!userChannel) return "Join a voice channel first.";

    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (player?.voiceChannelId && player.voiceChannelId !== userChannel.id) {
        return "You need to be in my voice channel to control this session.";
    }

    return null;
}

module.exports = {
    isManager,
    hasDjRole,
    canControl,
    sameVoice,
    voiceProblem
};
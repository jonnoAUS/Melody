/**
 * @param {number} ms
 * @returns {string}
 */
function time(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return "0:00";

    const total = Math.floor(ms / 1000);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * @param {string} value
 * @returns {number | null}
 */
function parseTime(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;

    if (/^\d+$/.test(raw)) {
        return Number(raw) * 1000;
    }

    const parts = raw.split(":").map((part) => Number.parseInt(part, 10));
    if (parts.some((part) => !Number.isFinite(part))) return null;

    if (parts.length === 2) {
        return ((parts[0] * 60) + parts[1]) * 1000;
    }

    if (parts.length === 3) {
        return ((parts[0] * 3600) + (parts[1] * 60) + parts[2]) * 1000;
    }

    return null;
}

/**
 * @param {number} ms
 * @returns {string}
 */
function roughTime(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return "unknown";

    const minutes = Math.round(ms / 60000);
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.floor(minutes / 60);
    const left = minutes % 60;
    return left ? `${hours}h ${left}m` : `${hours}h`;
}

/**
 * @param {number} position
 * @param {number} length
 * @returns {string}
 */
function progress(position, length) {
    const size = 18;

    if (!Number.isFinite(length) || length <= 0) {
        return `${"━".repeat(size)}  ${time(position)} / live`;
    }

    const ratio = Math.max(0, Math.min(1, position / length));
    const filled = Math.max(0, Math.min(size, Math.round(ratio * size)));
    const empty = size - filled;

    return `${"▰".repeat(filled)}${"▱".repeat(empty)}  ${time(position)} / ${time(length)}`;
}

/**
 * @param {string} text
 * @param {number} max
 * @returns {string}
 */
function cut(text, max) {
    const raw = String(text ?? "");
    if (raw.length <= max) return raw;
    return `${raw.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * @param {object | null | undefined} track
 * @returns {object}
 */
function trackInfo(track) {
    return track?.info || track || {};
}

/**
 * @param {object | null | undefined} track
 * @returns {string}
 */
function trackTitle(track) {
    return trackInfo(track).title || "Unknown Track";
}

/**
 * @param {object | null | undefined} track
 * @returns {string}
 */
function trackAuthor(track) {
    return trackInfo(track).author || "Unknown Artist";
}

/**
 * @param {object | null | undefined} track
 * @returns {number}
 */
function trackLength(track) {
    return Number(trackInfo(track).length || trackInfo(track).duration || 0);
}

/**
 * @param {object | null | undefined} track
 * @returns {string | null}
 */
function trackUri(track) {
    return trackInfo(track).uri || null;
}

/**
 * @param {object | null | undefined} track
 * @returns {string | null}
 */
function trackArtwork(track) {
    return trackInfo(track).artworkUrl || trackInfo(track).thumbnail || null;
}

/**
 * @param {object | null | undefined} track
 * @returns {string}
 */
function trackSource(track) {
    return trackInfo(track).sourceName || "unknown";
}

/**
 * @param {object | null | undefined} track
 * @returns {string}
 */
function trackLine(track) {
    const uri = trackUri(track);
    const label = `${trackTitle(track)} — ${trackAuthor(track)}`;
    return uri ? `[${cut(label, 80)}](${uri})` : cut(label, 80);
}

/**
 * @param {object | null | undefined} track
 * @returns {object}
 */
function serialTrack(track) {
    const info = trackInfo(track);

    return {
        encoded: track?.encoded || track?.track || null,
        title: info.title || "Unknown Track",
        author: info.author || "Unknown Artist",
        length: Number(info.length || 0),
        uri: info.uri || null,
        artworkUrl: info.artworkUrl || null,
        sourceName: info.sourceName || "unknown",
        identifier: info.identifier || null
    };
}

module.exports = {
    time,
    parseTime,
    roughTime,
    progress,
    cut,
    trackInfo,
    trackTitle,
    trackAuthor,
    trackLength,
    trackUri,
    trackArtwork,
    trackSource,
    trackLine,
    serialTrack
};
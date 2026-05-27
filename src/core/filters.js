const FILTERS = {
    off: {
        label: "Off",
        data: {}
    },
    bass: {
        label: "Bass Boost",
        data: {
            equalizer: [
                { band: 0, gain: 0.22 },
                { band: 1, gain: 0.18 },
                { band: 2, gain: 0.12 }
            ]
        }
    },
    nightcore: {
        label: "Nightcore",
        data: {
            timescale: {
                speed: 1.08,
                pitch: 1.16,
                rate: 1.0
            }
        }
    },
    vaporwave: {
        label: "Vaporwave",
        data: {
            timescale: {
                speed: 0.86,
                pitch: 0.82,
                rate: 1.0
            }
        }
    },
    lofi: {
        label: "Lo-fi Room",
        data: {
            timescale: {
                speed: 0.94,
                pitch: 0.98,
                rate: 1.0
            },
            lowPass: {
                smoothing: 18.0
            }
        }
    },
    karaoke: {
        label: "Karaoke",
        data: {
            karaoke: {
                level: 1.0,
                monoLevel: 1.0,
                filterBand: 220.0,
                filterWidth: 100.0
            }
        }
    },
    eightd: {
        label: "8D",
        data: {
            rotation: {
                rotationHz: 0.18
            }
        }
    },
    tremolo: {
        label: "Tremolo",
        data: {
            tremolo: {
                frequency: 2.0,
                depth: 0.45
            }
        }
    }
};

/**
 * @param {object} player
 * @param {string} key
 * @returns {Promise<string>}
 */
async function applyFilter(player, key) {
    const filter = FILTERS[key] || FILTERS.off;

    if (typeof player.setFilters === "function") {
        await player.setFilters(filter.data);
        return filter.label;
    }

    if (player.filterManager?.set) {
        await player.filterManager.set(filter.data);
        return filter.label;
    }

    player.melodyFilter = key;
    return filter.label;
}

/**
 * @returns {object}
 */
function allFilters() {
    return FILTERS;
}

module.exports = {
    applyFilter,
    allFilters
};
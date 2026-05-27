const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");
const { serialTrack } = require("./format.js");

/**
 * @param {string} file
 * @returns {Database.Database}
 */
function open(file) {
    const full = path.resolve(file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    return new Database(full);
}

/**
 * @param {Database.Database} db
 * @returns {void}
 */
function migrate(db) {
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    db.exec(`
        CREATE TABLE IF NOT EXISTS guild_settings (
            guild_id TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            PRIMARY KEY (guild_id, key)
        );

        CREATE TABLE IF NOT EXISTS playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT,
            owner_id TEXT NOT NULL,
            scope TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            UNIQUE(guild_id, owner_id, scope, name)
        );

        CREATE TABLE IF NOT EXISTS playlist_tracks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
            position INTEGER NOT NULL,
            payload TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS track_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            user_id TEXT,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            uri TEXT,
            artwork_url TEXT,
            source_name TEXT,
            length_ms INTEGER NOT NULL,
            played_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS player_panels (
            guild_id TEXT PRIMARY KEY,
            channel_id TEXT NOT NULL,
            message_id TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS vibe_rooms (
            guild_id TEXT PRIMARY KEY,
            host_id TEXT NOT NULL,
            theme TEXT NOT NULL,
            locked INTEGER NOT NULL,
            started_at INTEGER NOT NULL
        );
    `);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function encode(value) {
    return JSON.stringify(value);
}

/**
 * @param {string | null | undefined} value
 * @param {unknown} fallback
 * @returns {unknown}
 */
function decode(value, fallback) {
    try {
        return value == null ? fallback : JSON.parse(value);
    } catch {
        return fallback;
    }
}

/**
 * @param {string} file
 * @returns {object}
 */
function createDatabase(file) {
    const db = open(file);
    migrate(db);

    const q = {
        getSetting: db.prepare("SELECT value FROM guild_settings WHERE guild_id = ? AND key = ?"),
        setSetting: db.prepare(`
            INSERT INTO guild_settings (guild_id, key, value)
            VALUES (?, ?, ?)
            ON CONFLICT(guild_id, key) DO UPDATE SET value = excluded.value
        `),

        createPlaylist: db.prepare(`
            INSERT INTO playlists (guild_id, owner_id, scope, name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `),
        getPlaylist: db.prepare(`
            SELECT * FROM playlists
            WHERE guild_id IS ? AND owner_id = ? AND scope = ? AND lower(name) = lower(?)
        `),
        listUserPlaylists: db.prepare(`
            SELECT * FROM playlists
            WHERE guild_id IS ? AND owner_id = ? AND scope = ?
            ORDER BY updated_at DESC
        `),
        listServerPlaylists: db.prepare(`
            SELECT * FROM playlists
            WHERE guild_id = ? AND scope = 'server'
            ORDER BY updated_at DESC
        `),
        deletePlaylist: db.prepare("DELETE FROM playlists WHERE id = ?"),
        clearPlaylistTracks: db.prepare("DELETE FROM playlist_tracks WHERE playlist_id = ?"),
        addPlaylistTrack: db.prepare(`
            INSERT INTO playlist_tracks (playlist_id, position, payload)
            VALUES (?, ?, ?)
        `),
        getPlaylistTracks: db.prepare(`
            SELECT * FROM playlist_tracks
            WHERE playlist_id = ?
            ORDER BY position ASC
        `),
        touchPlaylist: db.prepare("UPDATE playlists SET updated_at = ? WHERE id = ?"),

        addHistory: db.prepare(`
            INSERT INTO track_history
            (guild_id, user_id, title, author, uri, artwork_url, source_name, length_ms, played_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `),
        guildStats: db.prepare(`
            SELECT COUNT(*) plays, COALESCE(SUM(length_ms), 0) length_ms
            FROM track_history
            WHERE guild_id = ?
        `),
        userStats: db.prepare(`
            SELECT COUNT(*) plays, COALESCE(SUM(length_ms), 0) length_ms
            FROM track_history
            WHERE guild_id = ? AND user_id = ?
        `),
        topTracks: db.prepare(`
            SELECT title, author, uri, artwork_url, COUNT(*) count
            FROM track_history
            WHERE guild_id = ?
            GROUP BY lower(title), lower(author)
            ORDER BY count DESC
            LIMIT ?
        `),
        topUsers: db.prepare(`
            SELECT user_id, COUNT(*) count
            FROM track_history
            WHERE guild_id = ? AND user_id IS NOT NULL
            GROUP BY user_id
            ORDER BY count DESC
            LIMIT ?
        `),

        savePanel: db.prepare(`
            INSERT INTO player_panels (guild_id, channel_id, message_id, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET
                channel_id = excluded.channel_id,
                message_id = excluded.message_id,
                updated_at = excluded.updated_at
        `),
        getPanel: db.prepare("SELECT * FROM player_panels WHERE guild_id = ?"),
        deletePanel: db.prepare("DELETE FROM player_panels WHERE guild_id = ?"),

        startRoom: db.prepare(`
            INSERT INTO vibe_rooms (guild_id, host_id, theme, locked, started_at)
            VALUES (?, ?, ?, 0, ?)
            ON CONFLICT(guild_id) DO UPDATE SET
                host_id = excluded.host_id,
                theme = excluded.theme,
                locked = 0,
                started_at = excluded.started_at
        `),
        getRoom: db.prepare("SELECT * FROM vibe_rooms WHERE guild_id = ?"),
        updateRoom: db.prepare("UPDATE vibe_rooms SET theme = ?, locked = ? WHERE guild_id = ?"),
        endRoom: db.prepare("DELETE FROM vibe_rooms WHERE guild_id = ?")
    };

    return {
        raw: db,

        /**
         * @param {string} guildId
         * @param {string} key
         * @param {unknown} fallback
         * @returns {unknown}
         */
        getSetting(guildId, key, fallback = null) {
            const row = q.getSetting.get(guildId, key);
            return decode(row?.value, fallback);
        },

        /**
         * @param {string} guildId
         * @param {string} key
         * @param {unknown} value
         * @returns {void}
         */
        setSetting(guildId, key, value) {
            q.setSetting.run(guildId, key, encode(value));
        },

        /**
         * @param {string | null} guildId
         * @param {string} ownerId
         * @param {string} scope
         * @param {string} name
         * @returns {object}
         */
        createPlaylist(guildId, ownerId, scope, name) {
            const now = Date.now();
            q.createPlaylist.run(guildId, ownerId, scope, name, now, now);
            return q.getPlaylist.get(guildId, ownerId, scope, name);
        },

        /**
         * @param {string | null} guildId
         * @param {string} ownerId
         * @param {string} scope
         * @param {string} name
         * @returns {object | null}
         */
        getPlaylist(guildId, ownerId, scope, name) {
            return q.getPlaylist.get(guildId, ownerId, scope, name) || null;
        },

        /**
         * @param {string | null} guildId
         * @param {string} ownerId
         * @param {string} scope
         * @returns {object[]}
         */
        listUserPlaylists(guildId, ownerId, scope) {
            return q.listUserPlaylists.all(guildId, ownerId, scope);
        },

        /**
         * @param {string} guildId
         * @returns {object[]}
         */
        listServerPlaylists(guildId) {
            return q.listServerPlaylists.all(guildId);
        },

        /**
         * @param {number} playlistId
         * @param {object[]} tracks
         * @returns {void}
         */
        replacePlaylistTracks(playlistId, tracks) {
            const tx = db.transaction((items) => {
                q.clearPlaylistTracks.run(playlistId);

                for (let i = 0; i < items.length; i++) {
                    q.addPlaylistTrack.run(playlistId, i, encode(serialTrack(items[i])));
                }

                q.touchPlaylist.run(Date.now(), playlistId);
            });

            tx(tracks);
        },

        /**
         * @param {number} playlistId
         * @returns {object[]}
         */
        getPlaylistTracks(playlistId) {
            return q.getPlaylistTracks.all(playlistId)
                .map((row) => decode(row.payload, null))
                .filter(Boolean);
        },

        /**
         * @param {number} playlistId
         * @returns {void}
         */
        deletePlaylist(playlistId) {
            q.deletePlaylist.run(playlistId);
        },

        /**
         * @param {string} guildId
         * @param {object} track
         * @returns {void}
         */
        addHistory(guildId, track) {
            const data = serialTrack(track);
            const requester = track?.requester || {};

            q.addHistory.run(
                guildId,
                requester.id || null,
                data.title,
                data.author,
                data.uri,
                data.artworkUrl,
                data.sourceName,
                data.length || 0,
                Date.now()
            );
        },

        /**
         * @param {string} guildId
         * @param {string} channelId
         * @param {string} messageId
         * @returns {void}
         */
        savePanel(guildId, channelId, messageId) {
            q.savePanel.run(guildId, channelId, messageId, Date.now());
        },

        /**
         * @param {string} guildId
         * @returns {object | null}
         */
        getPanel(guildId) {
            return q.getPanel.get(guildId) || null;
        },

        /**
         * @param {string} guildId
         * @returns {void}
         */
        deletePanel(guildId) {
            q.deletePanel.run(guildId);
        },

        /**
         * @param {string} guildId
         * @returns {object}
         */
        guildStats(guildId) {
            return q.guildStats.get(guildId);
        },

        /**
         * @param {string} guildId
         * @param {string} userId
         * @returns {object}
         */
        userStats(guildId, userId) {
            return q.userStats.get(guildId, userId);
        },

        /**
         * @param {string} guildId
         * @param {number} limit
         * @returns {object[]}
         */
        topTracks(guildId, limit) {
            return q.topTracks.all(guildId, limit);
        },

        /**
         * @param {string} guildId
         * @param {number} limit
         * @returns {object[]}
         */
        topUsers(guildId, limit) {
            return q.topUsers.all(guildId, limit);
        },

        /**
         * @param {string} guildId
         * @param {string} hostId
         * @param {string} theme
         * @returns {object}
         */
        startRoom(guildId, hostId, theme) {
            q.startRoom.run(guildId, hostId, theme, Date.now());
            return q.getRoom.get(guildId);
        },

        /**
         * @param {string} guildId
         * @returns {object | null}
         */
        getRoom(guildId) {
            return q.getRoom.get(guildId) || null;
        },

        /**
         * @param {string} guildId
         * @param {string} theme
         * @param {boolean} locked
         * @returns {void}
         */
        updateRoom(guildId, theme, locked) {
            q.updateRoom.run(theme, locked ? 1 : 0, guildId);
        },

        /**
         * @param {string} guildId
         * @returns {void}
         */
        endRoom(guildId) {
            q.endRoom.run(guildId);
        }
    };
}

module.exports = {
    createDatabase
};
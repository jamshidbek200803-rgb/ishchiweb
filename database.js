const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'ishchi.db'), { verbose: console.log });

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Baza jadvallarini yaratish
const initDb = () => {
    // Users table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            ism TEXT NOT NULL,
            telefon TEXT NOT NULL,
            viloyat TEXT NOT NULL,
            mode TEXT DEFAULT 'worker',
            transport TEXT,
            is_blocked INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Jobs table
    db.exec(`
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ish_turi TEXT NOT NULL,
            viloyat TEXT NOT NULL,
            maosh TEXT,
            telefon TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `);

    // Orders table
    db.exec(`
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            manzil TEXT NOT NULL,
            narx TEXT,
            viloyat TEXT NOT NULL,
            status TEXT DEFAULT 'active', -- active, taken, done
            user_id INTEGER NOT NULL,
            courier_id INTEGER,
            lat_from REAL,
            lon_from REAL,
            lat_to REAL,
            lon_to REAL,
            distance_km REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(courier_id) REFERENCES users(id)
        )
    `);

    // Migration for existing table
    try { db.exec("ALTER TABLE orders ADD COLUMN lat_from REAL"); } catch(e) {}
    try { db.exec("ALTER TABLE orders ADD COLUMN lon_from REAL"); } catch(e) {}
    try { db.exec("ALTER TABLE orders ADD COLUMN lat_to REAL"); } catch(e) {}
    try { db.exec("ALTER TABLE orders ADD COLUMN lon_to REAL"); } catch(e) {}
    try { db.exec("ALTER TABLE orders ADD COLUMN distance_km REAL"); } catch(e) {}
};

initDb();

module.exports = db;

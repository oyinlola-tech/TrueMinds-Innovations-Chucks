const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "../../chuks-kitchen.db");
const db = new Database(dbPath);

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  const info = stmt.run(params);
  return Promise.resolve({
    lastID: Number(info.lastInsertRowid || 0),
    changes: info.changes
  });
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  const row = stmt.get(params);
  return Promise.resolve(row);
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  const rows = stmt.all(params);
  return Promise.resolve(rows);
}

function exec(sql) {
  db.exec(sql);
  return Promise.resolve();
}

async function seedDefaults() {
  await run(
    `INSERT OR IGNORE INTO referrals (code, is_active, expires_at) VALUES (?, ?, ?)`,
    ["CHUKS10", 1, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()]
  );
  await run(
    `INSERT OR IGNORE INTO referrals (code, is_active, expires_at) VALUES (?, ?, ?)`,
    ["OLDREF", 0, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()]
  );

  const foodCount = await get(`SELECT COUNT(1) AS count FROM foods`);
  if (foodCount && foodCount.count === 0) {
    const now = new Date().toISOString();
    await run(
      `INSERT INTO foods (id, name, description, price, currency, is_available, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "food_1",
        "Jollof Rice & Chicken",
        "Smoky party jollof rice served with grilled chicken.",
        3500,
        "NGN",
        1,
        now,
        now
      ]
    );
    await run(
      `INSERT INTO foods (id, name, description, price, currency, is_available, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "food_2",
        "Pounded Yam & Egusi",
        "Fresh pounded yam with rich egusi soup.",
        4200,
        "NGN",
        1,
        now,
        now
      ]
    );
    await run(
      `INSERT INTO foods (id, name, description, price, currency, is_available, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "food_3",
        "Plantain & Fish Sauce",
        "Fried ripe plantain with spicy fish sauce.",
        3000,
        "NGN",
        0,
        now,
        now
      ]
    );
  }
}

async function initDb() {
  await exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT UNIQUE,
      role TEXT NOT NULL,
      is_verified INTEGER NOT NULL DEFAULT 0,
      referral_code TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verification_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      contact TEXT NOT NULL,
      otp_code TEXT NOT NULL,
      attempts_remaining INTEGER NOT NULL DEFAULT 3,
      expires_at TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS referrals (
      code TEXT PRIMARY KEY,
      is_active INTEGER NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS foods (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price REAL NOT NULL,
      currency TEXT NOT NULL,
      is_available INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS carts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_id TEXT NOT NULL,
      food_id TEXT NOT NULL,
      name TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      line_total REAL NOT NULL,
      FOREIGN KEY (cart_id) REFERENCES carts(id),
      FOREIGN KEY (food_id) REFERENCES foods(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      total_price REAL NOT NULL,
      currency TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      food_id TEXT NOT NULL,
      name TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      line_total REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS order_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );
  `);

  await seedDefaults();
}

module.exports = {
  db,
  run,
  get,
  all,
  exec,
  initDb
};

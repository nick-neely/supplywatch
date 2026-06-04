import type Database from "better-sqlite3";

export function initializeStateSchema(database: Database.Database): void {
  database.pragma("foreign_keys = ON");

  database.exec(`
    CREATE TABLE IF NOT EXISTS products (
      stable_id TEXT PRIMARY KEY,
      name TEXT,
      url TEXT,
      image_url TEXT,
      description TEXT,
      collection TEXT,
      price TEXT,
      normalized_snapshot_json TEXT NOT NULL,
      raw_fingerprint TEXT,
      buyable_state TEXT NOT NULL,
      available_sizes_json TEXT NOT NULL DEFAULT '[]',
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      first_public_at TEXT,
      out_of_stock_confirmations INTEGER NOT NULL DEFAULT 0,
      retired_at TEXT,
      retirement_reason TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_hash TEXT NOT NULL UNIQUE,
      event_type TEXT NOT NULL,
      product_id TEXT REFERENCES products(stable_id) ON DELETE SET NULL,
      payload_json TEXT NOT NULL,
      notification_status TEXT NOT NULL DEFAULT 'pending',
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT,
      notification_error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      notified_at TEXT
    );

    CREATE INDEX IF NOT EXISTS events_notification_status_idx
      ON events(notification_status, attempt_count, created_at);

    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL,
      product_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS product_overrides (
      product_id TEXT PRIMARY KEY,
      denylisted INTEGER NOT NULL DEFAULT 0,
      force_retired INTEGER NOT NULL DEFAULT 0,
      force_watched INTEGER NOT NULL DEFAULT 0,
      known_employee_only INTEGER NOT NULL DEFAULT 0,
      annotation TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

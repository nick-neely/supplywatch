import type Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { STATE_TABLE_NAMES } from "./tables.js";

const DRIZZLE_MIGRATIONS_TABLE = "__drizzle_migrations";
const INITIAL_MIGRATION = {
  hash: "592b61dbdbb0ed12fec6147aece3ed959837cc6214117a9befe97e2b1814c493",
  createdAt: 1780593124788,
};

export function initializeStateSchema(database: Database.Database): void {
  database.pragma("foreign_keys = ON");

  if (hasLegacyStateSchema(database)) {
    recordInitialMigration(database);
  }

  migrate(drizzle(database), { migrationsFolder: "drizzle" });
}

function hasLegacyStateSchema(database: Database.Database): boolean {
  if (tableExists(database, DRIZZLE_MIGRATIONS_TABLE)) {
    return false;
  }

  return STATE_TABLE_NAMES.every((table) => tableExists(database, table));
}

function tableExists(database: Database.Database, tableName: string): boolean {
  return Boolean(
    database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      )
      .get(tableName),
  );
}

function recordInitialMigration(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS "${DRIZZLE_MIGRATIONS_TABLE}" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric
    );
  `);
  database
    .prepare(
      `
        INSERT INTO "__drizzle_migrations" (hash, created_at)
        SELECT @hash, @createdAt
        WHERE NOT EXISTS (
          SELECT 1 FROM "__drizzle_migrations" WHERE hash = @hash
        )
      `,
    )
    .run(INITIAL_MIGRATION);
}

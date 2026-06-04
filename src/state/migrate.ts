import "dotenv/config";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { initializeStateSchema } from "./schema.js";

const databasePath = process.env.DATABASE_PATH ?? "./data/supplywatch.sqlite";

if (databasePath !== ":memory:") {
  mkdirSync(dirname(databasePath), { recursive: true });
}

const database = new Database(databasePath);

try {
  initializeStateSchema(database);
  console.log(`Applied state database migrations to ${databasePath}`);
} finally {
  database.close();
}

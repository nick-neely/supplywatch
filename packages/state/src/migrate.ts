import "dotenv/config";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import Database from "better-sqlite3";
import { initializeStateSchema } from "./schema.js";

if (isMainModule()) {
  runStateMigrations();
}

export function resolveDatabasePath(
  configuredPath: string | undefined,
): string {
  if (configuredPath === ":memory:") {
    return configuredPath;
  }

  const invocationDirectory = process.env.INIT_CWD ?? process.cwd();
  const path = configuredPath ?? join("data", "supplywatch.sqlite");

  return isAbsolute(path) ? path : resolve(invocationDirectory, path);
}

function runStateMigrations(): void {
  const databasePath = resolveDatabasePath(process.env.DATABASE_PATH);
  const databasePathLabel =
    process.env.DATABASE_PATH ?? "./data/supplywatch.sqlite";

  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const database = new Database(databasePath);

  try {
    initializeStateSchema(database);
    console.log(`Applied state database migrations to ${databasePathLabel}`);
  } finally {
    database.close();
  }
}

function isMainModule(): boolean {
  const entrypoint = process.argv[1];

  return entrypoint
    ? import.meta.url === pathToFileURL(entrypoint).href
    : false;
}

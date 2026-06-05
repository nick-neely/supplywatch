import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { WatcherStateRepository } from "./repository.js";

export type OpenStateRepository = {
  database: Database.Database;
  repository: WatcherStateRepository;
  close: () => void;
};

export function openStateRepository(databasePath: string): OpenStateRepository {
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const database = new Database(databasePath);
  const repository = new WatcherStateRepository(database);

  return {
    database,
    repository,
    close: () => database.close(),
  };
}

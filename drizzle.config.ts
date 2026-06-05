import "dotenv/config";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_PATH ?? "./data/supplywatch.sqlite";

if (databaseUrl !== ":memory:") {
  mkdirSync(dirname(databaseUrl), { recursive: true });
}

export default defineConfig({
  schema: "./packages/state/src/tables.ts",
  out: "./packages/state/drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: databaseUrl,
  },
});

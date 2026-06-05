import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveDashboardConfig } from "./config.js";
import { createDashboardServer } from "./server.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const defaultStaticDir = join(currentDirectory, "../client");

try {
  const config = resolveDashboardConfig(process.env);
  const server = await createDashboardServer({
    ...config,
    staticDir: config.staticDir ?? defaultStaticDir,
  });

  console.log(`Supplywatch dashboard listening at ${server.url}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

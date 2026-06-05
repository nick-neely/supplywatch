import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { resolveDashboardConfig } from "./config.js";
import { createDashboardServer } from "./server.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const defaultStaticDir = join(currentDirectory, "../client");
const workspaceRoot = findWorkspaceRoot(process.cwd());

loadDotenv({ path: resolve(workspaceRoot, ".env") });

try {
  const config = resolveDashboardConfig({
    ...process.env,
    INIT_CWD: workspaceRoot,
  });
  const server = await createDashboardServer({
    ...config,
    staticDir: config.staticDir ?? defaultStaticDir,
  });

  console.log(`Supplywatch dashboard listening at ${server.url}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function findWorkspaceRoot(startDirectory: string): string {
  let directory = startDirectory;

  while (!existsSync(resolve(directory, "pnpm-workspace.yaml"))) {
    const parent = dirname(directory);

    if (parent === directory) {
      return startDirectory;
    }

    directory = parent;
  }

  return directory;
}

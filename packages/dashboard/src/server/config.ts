import { isAbsolute, resolve } from "node:path";

export type DashboardConfig = {
  databasePath: string;
  host: string;
  port: number;
  staticDir: string | undefined;
};

type DashboardEnv = Partial<Record<string, string>>;

export function resolveDashboardConfig(env: DashboardEnv): DashboardConfig {
  const databasePath = env.DASHBOARD_DATABASE_PATH ?? env.DATABASE_PATH;

  if (!databasePath) {
    throw new Error(
      "Set DASHBOARD_DATABASE_PATH or DATABASE_PATH to a SQLite database file",
    );
  }

  return {
    databasePath: resolveDatabasePath(databasePath, env.INIT_CWD),
    host: env.DASHBOARD_HOST ?? "127.0.0.1",
    port: parsePort(env.DASHBOARD_PORT),
    staticDir: env.DASHBOARD_STATIC_DIR,
  };
}

function resolveDatabasePath(
  databasePath: string,
  invocationCwd: string | undefined,
): string {
  if (databasePath === ":memory:" || isAbsolute(databasePath)) {
    return databasePath;
  }

  return resolve(invocationCwd ?? process.cwd(), databasePath);
}

function parsePort(value: string | undefined): number {
  if (value === undefined) {
    return 4174;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error("DASHBOARD_PORT must be an integer from 0 to 65535");
  }

  return port;
}

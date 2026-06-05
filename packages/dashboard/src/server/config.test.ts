import { describe, expect, it } from "vitest";
import { resolveDashboardConfig } from "./config.js";

describe("dashboard config", () => {
  it("binds locally by default and requires an explicit database path", () => {
    expect(() => resolveDashboardConfig({})).toThrow(
      "Set DASHBOARD_DATABASE_PATH or DATABASE_PATH to a SQLite database file",
    );

    expect(
      resolveDashboardConfig({
        DATABASE_PATH: "./data/supplywatch.sqlite",
        INIT_CWD: "/workspace/supplywatch",
      }),
    ).toEqual({
      databasePath: "/workspace/supplywatch/data/supplywatch.sqlite",
      host: "127.0.0.1",
      port: 4174,
      staticDir: undefined,
    });
  });
});

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStateRepository } from "@supplywatch/state";
import { afterEach, describe, expect, it } from "vitest";
import { createDashboardServer } from "./server.js";

const servers: Array<{ close: () => Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("dashboard API server", () => {
  it("serves the watcher summary contract from persisted state", async () => {
    const directory = mkdtempSync(join(tmpdir(), "supplywatch-dashboard-api-"));
    const databasePath = join(directory, "supplywatch.sqlite");
    const state = openStateRepository(databasePath);
    const run = state.repository.startRun("2026-06-04T15:00:00.000Z");
    state.repository.finishRun(run.id, {
      finishedAt: "2026-06-04T15:00:03.000Z",
      status: "completed",
      productCount: 4,
      errorMessage: null,
    });
    state.close();

    try {
      const server = await createDashboardServer({
        databasePath,
        host: "127.0.0.1",
        port: 0,
        now: () => new Date("2026-06-04T15:05:00.000Z"),
      });
      servers.push(server);

      const response = await fetch(`${server.url}/api/summary`);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        generatedAt: "2026-06-04T15:05:00.000Z",
        latestRun: {
          status: "completed",
          productCount: 4,
        },
        notifications: {
          pending: 0,
          failed: 0,
        },
      });
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("fails fast when the configured database file cannot be opened", async () => {
    await expect(
      createDashboardServer({
        databasePath: "/tmp/supplywatch-missing-dashboard.sqlite",
        host: "127.0.0.1",
        port: 0,
      }),
    ).rejects.toThrow("Unable to open dashboard database read-only");
  });
});

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

  it("serves Products list and Product detail contracts from persisted state", async () => {
    const directory = mkdtempSync(join(tmpdir(), "supplywatch-products-api-"));
    const databasePath = join(directory, "supplywatch.sqlite");
    const state = openStateRepository(databasePath);

    state.repository.upsertProduct({
      stableId: "tee-api",
      name: "OpenAI Logo Tee",
      url: "https://example.com/products/tee",
      imageUrl: null,
      description: "A persisted tee.",
      collection: "Apparel",
      price: "$42",
      normalizedSnapshot: { title: "OpenAI Logo Tee" },
      rawFingerprint: "tee-fingerprint",
      buyableState: "publicly_buyable",
      availableSizes: ["M"],
      firstSeenAt: "2026-06-04T12:00:00.000Z",
      lastSeenAt: "2026-06-04T15:00:00.000Z",
      firstPublicAt: "2026-06-04T15:00:00.000Z",
      outOfStockConfirmations: 0,
      retiredAt: null,
      retirementReason: null,
    });
    state.repository.setProductOverride({
      productId: "tee-api",
      denylisted: false,
      forceRetired: false,
      forceWatched: true,
      knownEmployeeOnly: false,
      annotation: "watch this one",
    });
    state.close();

    try {
      const server = await createDashboardServer({
        databasePath,
        host: "127.0.0.1",
        port: 0,
      });
      servers.push(server);

      const listResponse = await fetch(
        `${server.url}/api/products?search=logo&availability=publicly_buyable&watchStatus=active&page=1&pageSize=25&sort=lastSeenAt.desc`,
      );
      const detailResponse = await fetch(`${server.url}/api/products/tee-api`);
      const missingResponse = await fetch(`${server.url}/api/products/missing`);

      expect(listResponse.status).toBe(200);
      await expect(listResponse.json()).resolves.toMatchObject({
        total: 1,
        products: [
          {
            stableId: "tee-api",
            availabilityState: "publicly_buyable",
            overrideBadges: ["force watched"],
          },
        ],
      });
      expect(detailResponse.status).toBe(200);
      await expect(detailResponse.json()).resolves.toMatchObject({
        stableId: "tee-api",
        sourceUrl: "https://example.com/products/tee",
        override: {
          annotation: "watch this one",
        },
        normalizedSnapshot: { title: "OpenAI Logo Tee" },
      });
      expect(missingResponse.status).toBe(404);
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

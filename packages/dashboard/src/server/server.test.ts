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

  it("serves filtered Runs with pagination metadata", async () => {
    const directory = mkdtempSync(join(tmpdir(), "supplywatch-dashboard-api-"));
    const databasePath = join(directory, "supplywatch.sqlite");
    const state = openStateRepository(databasePath);
    const failedRun = state.repository.startRun("2026-06-04T15:00:00.000Z");
    state.repository.finishRun(failedRun.id, {
      finishedAt: "2026-06-04T15:00:12.000Z",
      status: "failed",
      productCount: 3,
      errorMessage: "network timeout",
    });
    state.repository.startRun("2026-06-04T15:05:00.000Z");
    state.close();

    try {
      const server = await createDashboardServer({
        databasePath,
        host: "127.0.0.1",
        port: 0,
        now: () => new Date("2026-06-04T15:45:00.000Z"),
      });
      servers.push(server);

      const response = await fetch(
        `${server.url}/api/runs?status=failed&sort=startedAt&direction=asc&page=1&pageSize=10`,
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        pagination: {
          page: 1,
          pageSize: 10,
          totalItems: 1,
          totalPages: 1,
        },
        runs: [
          {
            id: failedRun.id,
            status: "failed",
            durationMs: 12_000,
            productCount: 3,
            hasError: true,
          },
        ],
      });
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("serves Run detail and missing Run responses", async () => {
    const directory = mkdtempSync(join(tmpdir(), "supplywatch-dashboard-api-"));
    const databasePath = join(directory, "supplywatch.sqlite");
    const state = openStateRepository(databasePath);
    const run = state.repository.startRun("2026-06-04T15:00:00.000Z");
    state.close();

    try {
      const server = await createDashboardServer({
        databasePath,
        host: "127.0.0.1",
        port: 0,
        now: () => new Date("2026-06-04T15:45:00.000Z"),
      });
      servers.push(server);

      const detailResponse = await fetch(`${server.url}/api/runs/${run.id}`);
      const missingResponse = await fetch(`${server.url}/api/runs/404`);

      expect(detailResponse.status).toBe(200);
      await expect(detailResponse.json()).resolves.toMatchObject({
        id: run.id,
        status: "running",
        staleRunning: {
          minutesSinceStart: 45,
        },
      });
      expect(missingResponse.status).toBe(404);
      await expect(missingResponse.json()).resolves.toEqual({
        error: "Run not found",
      });
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("serves filtered Events and Event detail responses", async () => {
    const directory = mkdtempSync(join(tmpdir(), "supplywatch-events-api-"));
    const databasePath = join(directory, "supplywatch.sqlite");
    const state = openStateRepository(databasePath);

    state.repository.upsertProduct({
      stableId: "tee-api-event",
      name: "OpenAI Logo Tee",
      url: "https://example.com/products/tee",
      imageUrl: null,
      description: "A persisted tee.",
      collection: "Apparel",
      price: "$42",
      normalizedSnapshot: { title: "OpenAI Logo Tee" },
      rawFingerprint: null,
      buyableState: "unknown",
      availableSizes: [],
      firstSeenAt: "2026-06-04T12:00:00.000Z",
      lastSeenAt: "2026-06-04T15:00:00.000Z",
      firstPublicAt: null,
      outOfStockConfirmations: 0,
      retiredAt: null,
      retirementReason: null,
    });
    const event = state.repository.recordEvent({
      eventHash: "api-candidate",
      eventType: "candidate_signal_detected",
      productId: "tee-api-event",
      payload: { signal: "animate-wiggle", evidenceOnly: true },
      notificationStatus: "failed",
      attemptCount: 2,
      lastAttemptAt: "2026-06-04T15:01:00.000Z",
      notificationError: "Discord webhook failed",
      createdAt: "2026-06-04T15:00:00.000Z",
      notifiedAt: null,
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
        `${server.url}/api/events?eventType=candidate_signal_detected&notificationStatus=failed&productId=tee-api-event&sort=createdAt&direction=asc&page=1&pageSize=10`,
      );
      const detailResponse = await fetch(
        `${server.url}/api/events/${event.id}`,
      );
      const missingResponse = await fetch(`${server.url}/api/events/404`);

      expect(listResponse.status).toBe(200);
      await expect(listResponse.json()).resolves.toMatchObject({
        pagination: {
          page: 1,
          pageSize: 10,
          totalItems: 1,
          totalPages: 1,
        },
        events: [
          {
            id: event.id,
            eventType: "candidate_signal_detected",
            productId: "tee-api-event",
            productName: "OpenAI Logo Tee",
            notificationStatus: "failed",
            hasNotificationError: true,
          },
        ],
      });
      expect(detailResponse.status).toBe(200);
      await expect(detailResponse.json()).resolves.toMatchObject({
        id: event.id,
        payload: { signal: "animate-wiggle", evidenceOnly: true },
        notificationError: "Discord webhook failed",
      });
      expect(missingResponse.status).toBe(404);
      await expect(missingResponse.json()).resolves.toEqual({
        error: "Event not found",
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

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getWatcherDashboardSummary,
  openReadOnlyStateDatabase,
  openStateRepository,
} from "@supplywatch/state";
import { describe, expect, it } from "vitest";

describe("watcher dashboard summary read model", () => {
  it("opens configured SQLite state without allowing writes", () => {
    const directory = mkdtempSync(join(tmpdir(), "supplywatch-dashboard-"));
    const databasePath = join(directory, "supplywatch.sqlite");
    const state = openStateRepository(databasePath);
    state.close();

    const readonly = openReadOnlyStateDatabase(databasePath);
    try {
      expect(() => {
        readonly.database.exec(
          "CREATE TABLE dashboard_write_probe (id INTEGER)",
        );
      }).toThrow(/readonly|read-only/i);
    } finally {
      readonly.close();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("summarizes persisted watcher health from a read-only database", () => {
    const directory = mkdtempSync(join(tmpdir(), "supplywatch-dashboard-"));
    const databasePath = join(directory, "supplywatch.sqlite");
    const state = openStateRepository(databasePath);
    let runningRunId = 0;

    try {
      runningRunId = state.repository.startRun("2026-06-04T15:00:00.000Z").id;
      state.repository.finishRun(
        state.repository.startRun("2026-06-04T14:00:00.000Z").id,
        {
          finishedAt: "2026-06-04T14:00:08.000Z",
          status: "completed",
          productCount: 12,
          errorMessage: null,
        },
      );
      state.repository.recordEvent({
        eventHash: "pending-health-zero-products",
        eventType: "run_zero_products",
        productId: null,
        payload: { alertKind: "health" },
        notificationStatus: "pending",
        attemptCount: 0,
        lastAttemptAt: null,
        notificationError: null,
        createdAt: "2026-06-04T15:01:00.000Z",
        notifiedAt: null,
      });
      state.repository.recordEvent({
        eventHash: "failed-merch-alert",
        eventType: "product_publicly_buyable",
        productId: null,
        payload: { productName: "OpenAI Tee" },
        notificationStatus: "failed",
        attemptCount: 3,
        lastAttemptAt: "2026-06-04T15:03:00.000Z",
        notificationError: "webhook timeout",
        createdAt: "2026-06-04T15:02:00.000Z",
        notifiedAt: null,
      });
    } finally {
      state.close();
    }

    const readonly = openReadOnlyStateDatabase(databasePath);
    try {
      expect(
        getWatcherDashboardSummary(readonly.database, {
          now: new Date("2026-06-04T15:45:00.000Z"),
        }),
      ).toEqual({
        generatedAt: "2026-06-04T15:45:00.000Z",
        latestRun: {
          id: 1,
          startedAt: "2026-06-04T15:00:00.000Z",
          finishedAt: null,
          status: "running",
          productCount: 0,
          errorMessage: null,
        },
        staleRunningRun: {
          id: runningRunId,
          startedAt: "2026-06-04T15:00:00.000Z",
          minutesSinceStart: 45,
        },
        notifications: {
          pending: 1,
          failed: 1,
        },
        healthEvents: {
          total: 1,
          byType: [{ eventType: "run_zero_products", count: 1 }],
        },
      });
    } finally {
      readonly.close();
      rmSync(directory, { force: true, recursive: true });
    }
  });
});

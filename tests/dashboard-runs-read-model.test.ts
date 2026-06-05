import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getDashboardRunDetail,
  listDashboardRuns,
  openReadOnlyStateDatabase,
  openStateRepository,
} from "@supplywatch/state";
import { describe, expect, it } from "vitest";

describe("watcher dashboard Runs read model", () => {
  it("filters, sorts, and paginates persisted Runs server-side", () => {
    const fixture = createRunsFixture();

    try {
      const readonly = openReadOnlyStateDatabase(fixture.databasePath);
      try {
        expect(
          listDashboardRuns(readonly.database, {
            status: "failed",
            sortBy: "startedAt",
            sortDirection: "asc",
            page: 1,
            pageSize: 1,
            now: new Date("2026-06-04T15:45:00.000Z"),
          }),
        ).toMatchObject({
          pagination: {
            page: 1,
            pageSize: 1,
            totalItems: 2,
            totalPages: 2,
          },
          runs: [
            {
              id: fixture.failedOlderRunId,
              status: "failed",
              startedAt: "2026-06-04T13:00:00.000Z",
              finishedAt: "2026-06-04T13:00:04.000Z",
              durationMs: 4000,
              productCount: 2,
              hasError: true,
              staleRunning: null,
            },
          ],
        });
      } finally {
        readonly.close();
      }
    } finally {
      fixture.cleanup();
    }
  });

  it("returns run detail and missing Run state by stable Run ID", () => {
    const fixture = createRunsFixture();

    try {
      const readonly = openReadOnlyStateDatabase(fixture.databasePath);
      try {
        expect(
          getDashboardRunDetail(readonly.database, fixture.failedNewerRunId, {
            now: new Date("2026-06-04T15:45:00.000Z"),
          }),
        ).toEqual({
          id: fixture.failedNewerRunId,
          status: "failed",
          startedAt: "2026-06-04T15:00:00.000Z",
          finishedAt: "2026-06-04T15:00:10.000Z",
          durationMs: 10_000,
          productCount: 9,
          errorMessage: "detail inspection timed out",
          hasError: true,
          staleRunning: null,
        });
        expect(getDashboardRunDetail(readonly.database, 404)).toBeNull();
      } finally {
        readonly.close();
      }
    } finally {
      fixture.cleanup();
    }
  });

  it("marks stale-looking running Runs from persisted timestamps only", () => {
    const fixture = createRunsFixture();

    try {
      const readonly = openReadOnlyStateDatabase(fixture.databasePath);
      try {
        expect(
          getDashboardRunDetail(readonly.database, fixture.runningRunId, {
            now: new Date("2026-06-04T15:45:00.000Z"),
            staleRunningRunMinutes: 30,
          }),
        ).toMatchObject({
          id: fixture.runningRunId,
          status: "running",
          durationMs: null,
          staleRunning: {
            startedAt: "2026-06-04T15:05:00.000Z",
            minutesSinceStart: 40,
          },
        });
      } finally {
        readonly.close();
      }
    } finally {
      fixture.cleanup();
    }
  });
});

function createRunsFixture(): {
  databasePath: string;
  runningRunId: number;
  failedOlderRunId: number;
  failedNewerRunId: number;
  cleanup: () => void;
} {
  const directory = mkdtempSync(join(tmpdir(), "supplywatch-dashboard-runs-"));
  const databasePath = join(directory, "supplywatch.sqlite");
  const state = openStateRepository(databasePath);

  try {
    const runningRunId = state.repository.startRun(
      "2026-06-04T15:05:00.000Z",
    ).id;
    const failedNewerRunId = state.repository.startRun(
      "2026-06-04T15:00:00.000Z",
    ).id;
    state.repository.finishRun(failedNewerRunId, {
      finishedAt: "2026-06-04T15:00:10.000Z",
      status: "failed",
      productCount: 9,
      errorMessage: "detail inspection timed out",
    });
    state.repository.finishRun(
      state.repository.startRun("2026-06-04T14:00:00.000Z").id,
      {
        finishedAt: "2026-06-04T14:00:06.000Z",
        status: "completed",
        productCount: 12,
        errorMessage: null,
      },
    );
    const failedOlderRunId = state.repository.startRun(
      "2026-06-04T13:00:00.000Z",
    ).id;
    state.repository.finishRun(failedOlderRunId, {
      finishedAt: "2026-06-04T13:00:04.000Z",
      status: "failed",
      productCount: 2,
      errorMessage: "webhook timeout",
    });

    return {
      databasePath,
      runningRunId,
      failedOlderRunId,
      failedNewerRunId,
      cleanup: () => rmSync(directory, { force: true, recursive: true }),
    };
  } finally {
    state.close();
  }
}

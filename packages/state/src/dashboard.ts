import type Database from "better-sqlite3";
import type { RunStatus } from "./types.js";

const DEFAULT_STALE_RUNNING_RUN_MINUTES = 30;

export type DashboardRunSummary = {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: RunStatus;
  productCount: number;
  errorMessage: string | null;
};

export type DashboardStaleRunningRun = {
  id: number;
  startedAt: string;
  minutesSinceStart: number;
};

export type DashboardHealthEventCount = {
  eventType: string;
  count: number;
};

export type WatcherDashboardSummary = {
  generatedAt: string;
  latestRun: DashboardRunSummary | null;
  staleRunningRun: DashboardStaleRunningRun | null;
  notifications: {
    pending: number;
    failed: number;
  };
  healthEvents: {
    total: number;
    byType: DashboardHealthEventCount[];
  };
};

export type WatcherDashboardSummaryOptions = {
  now?: Date;
  staleRunningRunMinutes?: number;
};

type RunRow = {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: RunStatus;
  productCount: number;
  errorMessage: string | null;
};

type NotificationCountRow = {
  notificationStatus: string;
  count: number;
};

type HealthEventCountRow = {
  eventType: string;
  count: number;
};

export function getWatcherDashboardSummary(
  database: Database.Database,
  options: WatcherDashboardSummaryOptions = {},
): WatcherDashboardSummary {
  const now = options.now ?? new Date();
  const staleRunningRunMinutes =
    options.staleRunningRunMinutes ?? DEFAULT_STALE_RUNNING_RUN_MINUTES;
  const latestRun = database
    .prepare<[], RunRow>(
      `
        SELECT
          id,
          started_at AS startedAt,
          finished_at AS finishedAt,
          status,
          product_count AS productCount,
          error_message AS errorMessage
        FROM runs
        ORDER BY started_at DESC, id DESC
        LIMIT 1
      `,
    )
    .get();

  const notificationCounts = database
    .prepare<[], NotificationCountRow>(
      `
        SELECT notification_status AS notificationStatus, COUNT(*) AS count
        FROM events
        WHERE notification_status IN ('pending', 'failed')
        GROUP BY notification_status
      `,
    )
    .all();
  const healthEventCounts = database
    .prepare<[], HealthEventCountRow>(
      `
        SELECT event_type AS eventType, COUNT(*) AS count
        FROM events
        WHERE json_extract(payload_json, '$.alertKind') = 'health'
        GROUP BY event_type
        ORDER BY event_type ASC
      `,
    )
    .all();

  return {
    generatedAt: now.toISOString(),
    latestRun: latestRun ?? null,
    staleRunningRun: latestRun
      ? summarizeStaleRunningRun(latestRun, now, staleRunningRunMinutes)
      : null,
    notifications: {
      pending: countNotifications(notificationCounts, "pending"),
      failed: countNotifications(notificationCounts, "failed"),
    },
    healthEvents: {
      total: healthEventCounts.reduce((total, row) => total + row.count, 0),
      byType: healthEventCounts,
    },
  };
}

function summarizeStaleRunningRun(
  run: RunRow,
  now: Date,
  thresholdMinutes: number,
): DashboardStaleRunningRun | null {
  if (run.status !== "running") {
    return null;
  }

  const minutesSinceStart = Math.floor(
    (now.getTime() - new Date(run.startedAt).getTime()) / 60_000,
  );

  if (minutesSinceStart < thresholdMinutes) {
    return null;
  }

  return {
    id: run.id,
    startedAt: run.startedAt,
    minutesSinceStart,
  };
}

function countNotifications(
  rows: NotificationCountRow[],
  status: "pending" | "failed",
): number {
  return rows.find((row) => row.notificationStatus === status)?.count ?? 0;
}

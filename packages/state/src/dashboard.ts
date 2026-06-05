import type Database from "better-sqlite3";
import type { NotificationStatus, RunStatus } from "./types.js";

const DEFAULT_STALE_RUNNING_RUN_MINUTES = 30;
const DEFAULT_RUNS_PAGE = 1;
const DEFAULT_RUNS_PAGE_SIZE = 25;
const MAX_RUNS_PAGE_SIZE = 100;
const DEFAULT_RUN_SORT_BY = "startedAt";
const DEFAULT_RUN_SORT_DIRECTION = "desc";
const RUN_SORT_EXPRESSIONS = {
  finishedAt: "finished_at",
  productCount: "product_count",
  startedAt: "started_at",
  status: "status",
} as const satisfies Record<DashboardRunSortBy, string>;
const RUN_SUMMARY_COLUMNS = `
  id,
  started_at AS startedAt,
  finished_at AS finishedAt,
  status,
  product_count AS productCount,
  error_message AS errorMessage
`;

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

export type DashboardRunSortBy =
  | "startedAt"
  | "finishedAt"
  | "status"
  | "productCount";

export type DashboardSortDirection = "asc" | "desc";

export type DashboardRunListOptions = {
  status?: RunStatus;
  sortBy?: DashboardRunSortBy;
  sortDirection?: DashboardSortDirection;
  page?: number;
  pageSize?: number;
  now?: Date;
  staleRunningRunMinutes?: number;
};

export type DashboardRunDetailOptions = {
  now?: Date;
  staleRunningRunMinutes?: number;
};

export type DashboardRunStaleState = {
  startedAt: string;
  minutesSinceStart: number;
};

export type DashboardRunRow = DashboardRunSummary & {
  durationMs: number | null;
  hasError: boolean;
  staleRunning: DashboardRunStaleState | null;
};

export type DashboardRunsPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type DashboardRunList = {
  runs: DashboardRunRow[];
  pagination: DashboardRunsPagination;
};

type NotificationCountRow = {
  notificationStatus: NotificationStatus;
  count: number;
};

type CountRow = {
  count: number;
};

export function getWatcherDashboardSummary(
  database: Database.Database,
  options: WatcherDashboardSummaryOptions = {},
): WatcherDashboardSummary {
  const now = options.now ?? new Date();
  const staleRunningRunMinutes =
    options.staleRunningRunMinutes ?? DEFAULT_STALE_RUNNING_RUN_MINUTES;
  const latestRun = findLatestRun(database);
  const notificationCounts = countNotificationsByStatus(database);
  const healthEventCounts = countHealthEventsByType(database);

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

export function listDashboardRuns(
  database: Database.Database,
  options: DashboardRunListOptions = {},
): DashboardRunList {
  const now = options.now ?? new Date();
  const staleRunningRunMinutes =
    options.staleRunningRunMinutes ?? DEFAULT_STALE_RUNNING_RUN_MINUTES;
  const page = normalizePositiveInteger(options.page, DEFAULT_RUNS_PAGE);
  const pageSize = Math.min(
    normalizePositiveInteger(options.pageSize, DEFAULT_RUNS_PAGE_SIZE),
    MAX_RUNS_PAGE_SIZE,
  );
  const totalItems = countRuns(database, options.status);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const sortBy = normalizeRunSortBy(options.sortBy);
  const sortDirection = normalizeSortDirection(options.sortDirection);
  const offset = (page - 1) * pageSize;
  const runs = database
    .prepare<Record<string, unknown>, DashboardRunSummary>(
      `
        SELECT ${RUN_SUMMARY_COLUMNS}
        FROM runs
        ${options.status ? "WHERE status = @status" : ""}
        ORDER BY ${runSortExpression(sortBy)} ${sortDirection}, id ${sortDirection}
        LIMIT @limit OFFSET @offset
      `,
    )
    .all({
      status: options.status,
      limit: pageSize,
      offset,
    });

  return {
    runs: runs.map((run) => mapDashboardRun(run, now, staleRunningRunMinutes)),
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
  };
}

export function getDashboardRunDetail(
  database: Database.Database,
  runId: number,
  options: DashboardRunDetailOptions = {},
): DashboardRunRow | null {
  const run = database
    .prepare<{ id: number }, DashboardRunSummary>(
      `
        SELECT ${RUN_SUMMARY_COLUMNS}
        FROM runs
        WHERE id = @id
      `,
    )
    .get({ id: runId });

  return run
    ? mapDashboardRun(
        run,
        options.now ?? new Date(),
        options.staleRunningRunMinutes ?? DEFAULT_STALE_RUNNING_RUN_MINUTES,
      )
    : null;
}

function summarizeStaleRunningRun(
  run: DashboardRunSummary,
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

function mapDashboardRun(
  run: DashboardRunSummary,
  now: Date,
  staleRunningRunMinutes: number,
): DashboardRunRow {
  return {
    ...run,
    durationMs: calculateDurationMs(run),
    hasError: Boolean(run.errorMessage),
    staleRunning: summarizeStaleRunningRun(run, now, staleRunningRunMinutes),
  };
}

function calculateDurationMs(run: DashboardRunSummary): number | null {
  if (!run.finishedAt) {
    return null;
  }

  return new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
}

function countRuns(
  database: Database.Database,
  status: RunStatus | undefined,
): number {
  return (
    database
      .prepare<Record<string, unknown>, CountRow>(
        `
          SELECT COUNT(*) AS count
          FROM runs
          ${status ? "WHERE status = @status" : ""}
        `,
      )
      .get({ status })?.count ?? 0
  );
}

function runSortExpression(sortBy: DashboardRunSortBy): string {
  return RUN_SORT_EXPRESSIONS[sortBy];
}

function normalizeRunSortBy(
  sortBy: DashboardRunSortBy | undefined,
): DashboardRunSortBy {
  switch (sortBy) {
    case "finishedAt":
    case "status":
    case "productCount":
    case "startedAt":
      return sortBy;
    default:
      return DEFAULT_RUN_SORT_BY;
  }
}

function normalizeSortDirection(
  sortDirection: DashboardSortDirection | undefined,
): DashboardSortDirection {
  return sortDirection === "asc" ? "asc" : DEFAULT_RUN_SORT_DIRECTION;
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  if (!Number.isInteger(value) || !value || value < 1) {
    return fallback;
  }

  return value;
}

function findLatestRun(
  database: Database.Database,
): DashboardRunSummary | undefined {
  return database
    .prepare<[], DashboardRunSummary>(
      `
        SELECT ${RUN_SUMMARY_COLUMNS}
        FROM runs
        ORDER BY started_at DESC, id DESC
        LIMIT 1
      `,
    )
    .get();
}

function countNotificationsByStatus(
  database: Database.Database,
): NotificationCountRow[] {
  return database
    .prepare<[], NotificationCountRow>(
      `
        SELECT notification_status AS notificationStatus, COUNT(*) AS count
        FROM events
        WHERE notification_status IN ('pending', 'failed')
        GROUP BY notification_status
      `,
    )
    .all();
}

function countHealthEventsByType(
  database: Database.Database,
): DashboardHealthEventCount[] {
  return database
    .prepare<[], DashboardHealthEventCount>(
      `
        SELECT event_type AS eventType, COUNT(*) AS count
        FROM events
        WHERE json_extract(payload_json, '$.alertKind') = 'health'
        GROUP BY event_type
        ORDER BY event_type ASC
      `,
    )
    .all();
}

function countNotifications(
  rows: NotificationCountRow[],
  status: "pending" | "failed",
): number {
  return rows.find((row) => row.notificationStatus === status)?.count ?? 0;
}

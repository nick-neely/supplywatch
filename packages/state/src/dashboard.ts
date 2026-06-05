import type Database from "better-sqlite3";
import type { JsonObject, ProductOverride } from "./repository.js";
import type { BuyableState, NotificationStatus, RunStatus } from "./types.js";

const DEFAULT_STALE_RUNNING_RUN_MINUTES = 30;
const DEFAULT_RUNS_PAGE = 1;
const DEFAULT_RUNS_PAGE_SIZE = 25;
const MAX_RUNS_PAGE_SIZE = 100;
const DEFAULT_EVENTS_PAGE = 1;
const DEFAULT_EVENTS_PAGE_SIZE = 50;
const MAX_EVENTS_PAGE_SIZE = 200;
const DEFAULT_RUN_SORT_BY = "startedAt";
const DEFAULT_EVENT_SORT_BY = "createdAt";
const DEFAULT_RUN_SORT_DIRECTION = "desc";
const DEFAULT_EVENT_SORT_DIRECTION = "desc";
const RUN_SORT_EXPRESSIONS = {
  finishedAt: "finished_at",
  productCount: "product_count",
  startedAt: "started_at",
  status: "status",
} as const satisfies Record<DashboardRunSortBy, string>;
const EVENT_SORT_EXPRESSIONS = {
  attemptCount: "e.attempt_count",
  createdAt: "e.created_at",
  eventType: "e.event_type",
  notificationStatus: "e.notification_status",
  notifiedAt: "e.notified_at",
} as const satisfies Record<DashboardEventSortBy, string>;
const RUN_SUMMARY_COLUMNS = `
  id,
  started_at AS startedAt,
  finished_at AS finishedAt,
  status,
  product_count AS productCount,
  error_message AS errorMessage
`;
const EVENT_COLUMNS = `
  e.id,
  e.event_type AS eventType,
  e.product_id AS productId,
  p.name AS productName,
  e.payload_json AS payloadJson,
  e.notification_status AS notificationStatus,
  e.attempt_count AS attemptCount,
  e.last_attempt_at AS lastAttemptAt,
  e.notification_error AS notificationError,
  e.created_at AS createdAt,
  e.notified_at AS notifiedAt
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

export type DashboardEventSortBy =
  | "createdAt"
  | "notifiedAt"
  | "eventType"
  | "notificationStatus"
  | "attemptCount";

export type DashboardEventListOptions = {
  eventType?: string;
  notificationStatus?: NotificationStatus;
  productId?: string;
  sortBy?: DashboardEventSortBy;
  sortDirection?: DashboardSortDirection;
  page?: number;
  pageSize?: number;
};

export type DashboardEventRow = {
  id: number;
  eventType: string;
  productId: string | null;
  productName: string | null;
  notificationStatus: NotificationStatus;
  attemptCount: number;
  lastAttemptAt: string | null;
  createdAt: string;
  notifiedAt: string | null;
  hasPayload: boolean;
  hasNotificationError: boolean;
};

export type DashboardEventDetail = DashboardEventRow & {
  payload: JsonObject;
  notificationError: string | null;
};

export type DashboardEventsPagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type DashboardEventList = {
  events: DashboardEventRow[];
  pagination: DashboardEventsPagination;
};

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

export type DashboardProductSortField =
  | "name"
  | "collection"
  | "price"
  | "availabilityState"
  | "lastSeenAt"
  | "firstSeenAt";

export const DASHBOARD_PRODUCT_SORT_FIELDS = [
  "name",
  "collection",
  "price",
  "availabilityState",
  "lastSeenAt",
  "firstSeenAt",
] as const satisfies readonly DashboardProductSortField[];

export type DashboardProductSort = {
  field: DashboardProductSortField;
  direction: "asc" | "desc";
};

export type DashboardProductWatchStatus = "active" | "retired" | "all";

export const DASHBOARD_PRODUCT_WATCH_STATUSES = [
  "active",
  "retired",
  "all",
] as const satisfies readonly DashboardProductWatchStatus[];

export type DashboardProductListOptions = {
  search?: string;
  availabilityStates?: BuyableState[];
  watchStatus?: DashboardProductWatchStatus;
  collection?: string;
  notificationRelevant?: boolean;
  sort?: DashboardProductSort;
  page?: number;
  pageSize?: number;
};

export type DashboardProductRow = {
  stableId: string;
  name: string | null;
  url: string | null;
  imageUrl: string | null;
  collection: string | null;
  price: string | null;
  availabilityState: BuyableState;
  availableSizes: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  firstPublicAt: string | null;
  isRetired: boolean;
  retiredAt: string | null;
  retirementReason: string | null;
  outOfStockConfirmations: number;
  overrideBadges: string[];
};

export type DashboardProductPage = {
  products: DashboardProductRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type DashboardProductEvent = {
  id: number;
  eventType: string;
  payload: JsonObject;
  notificationStatus: NotificationStatus;
  attemptCount: number;
  lastAttemptAt: string | null;
  notificationError: string | null;
  createdAt: string;
  notifiedAt: string | null;
};

export type DashboardProductDetail = DashboardProductRow & {
  sourceUrl: string | null;
  description: string | null;
  normalizedSnapshot: JsonObject;
  rawFingerprint: string | null;
  override: ProductOverride | null;
  recentEvents: DashboardProductEvent[];
};

type ProductListSqlRow = {
  stableId: string;
  name: string | null;
  url: string | null;
  imageUrl: string | null;
  collection: string | null;
  price: string | null;
  availabilityState: BuyableState;
  availableSizesJson: string;
  firstSeenAt: string;
  lastSeenAt: string;
  firstPublicAt: string | null;
  isRetired: 0 | 1;
  retiredAt: string | null;
  retirementReason: string | null;
  outOfStockConfirmations: number;
  denylisted: 0 | 1 | null;
  forceRetired: 0 | 1 | null;
  forceWatched: 0 | 1 | null;
  knownEmployeeOnly: 0 | 1 | null;
};

type ProductDetailSqlRow = ProductListSqlRow & {
  description: string | null;
  normalizedSnapshotJson: string;
  rawFingerprint: string | null;
  annotation: string | null;
};

type ProductEventSqlRow = {
  id: number;
  eventType: string;
  payloadJson: string;
  notificationStatus: NotificationStatus;
  attemptCount: number;
  lastAttemptAt: string | null;
  notificationError: string | null;
  createdAt: string;
  notifiedAt: string | null;
};

type EventSqlRow = {
  id: number;
  eventType: string;
  productId: string | null;
  productName: string | null;
  payloadJson: string;
  notificationStatus: NotificationStatus;
  attemptCount: number;
  lastAttemptAt: string | null;
  notificationError: string | null;
  createdAt: string;
  notifiedAt: string | null;
};

const PRODUCT_SORT_COLUMNS: Record<DashboardProductSortField, string> = {
  name: "p.name",
  collection: "p.collection",
  price: "p.price",
  availabilityState: "p.buyable_state",
  lastSeenAt: "p.last_seen_at",
  firstSeenAt: "p.first_seen_at",
};

const DEFAULT_PRODUCT_PAGE_SIZE = 50;
const MAX_PRODUCT_PAGE_SIZE = 200;

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

export function listDashboardEvents(
  database: Database.Database,
  options: DashboardEventListOptions = {},
): DashboardEventList {
  const page = normalizePositiveInteger(options.page, DEFAULT_EVENTS_PAGE);
  const pageSize = Math.min(
    normalizePositiveInteger(options.pageSize, DEFAULT_EVENTS_PAGE_SIZE),
    MAX_EVENTS_PAGE_SIZE,
  );
  const where = buildEventWhereClause(options);
  const totalItems = countEvents(database, where);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const sortBy = normalizeEventSortBy(options.sortBy);
  const sortDirection = normalizeEventSortDirection(options.sortDirection);
  const rows = database
    .prepare<Record<string, unknown>, EventSqlRow>(
      `
        SELECT ${EVENT_COLUMNS}
        FROM events e
        LEFT JOIN products p ON p.stable_id = e.product_id
        ${where.sql}
        ORDER BY ${eventSortExpression(sortBy)} ${sortDirection}, e.id ${sortDirection}
        LIMIT @limit OFFSET @offset
      `,
    )
    .all({
      ...where.parameters,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

  return {
    events: rows.map(mapDashboardEventRow),
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
  };
}

export function getDashboardEventDetail(
  database: Database.Database,
  eventId: number,
): DashboardEventDetail | null {
  const row = database
    .prepare<{ id: number }, EventSqlRow>(
      `
        SELECT ${EVENT_COLUMNS}
        FROM events e
        LEFT JOIN products p ON p.stable_id = e.product_id
        WHERE e.id = @id
      `,
    )
    .get({ id: eventId });

  if (!row) {
    return null;
  }

  return {
    ...mapDashboardEventRow(row),
    payload: JSON.parse(row.payloadJson) as JsonObject,
    notificationError: row.notificationError,
  };
}

export function getDashboardProducts(
  database: Database.Database,
  options: DashboardProductListOptions = {},
): DashboardProductPage {
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.min(
    MAX_PRODUCT_PAGE_SIZE,
    Math.max(1, Math.floor(options.pageSize ?? DEFAULT_PRODUCT_PAGE_SIZE)),
  );
  const where = buildProductWhereClause(options);
  const total = database
    .prepare<Record<string, unknown>, { count: number }>(
      `
        SELECT COUNT(*) AS count
        FROM products p
        LEFT JOIN product_overrides po ON po.product_id = p.stable_id
        ${where.sql}
      `,
    )
    .get(where.parameters)?.count;

  const sort = options.sort ?? { field: "lastSeenAt", direction: "desc" };
  const sortColumn = PRODUCT_SORT_COLUMNS[sort.field];
  const sortDirection = sort.direction === "asc" ? "ASC" : "DESC";
  const rows = database
    .prepare<Record<string, unknown>, ProductListSqlRow>(
      `
        SELECT
          p.stable_id AS stableId,
          p.name,
          p.url,
          p.image_url AS imageUrl,
          p.collection,
          p.price,
          p.buyable_state AS availabilityState,
          p.available_sizes_json AS availableSizesJson,
          p.first_seen_at AS firstSeenAt,
          p.last_seen_at AS lastSeenAt,
          p.first_public_at AS firstPublicAt,
          CASE WHEN p.retired_at IS NULL THEN 0 ELSE 1 END AS isRetired,
          p.retired_at AS retiredAt,
          p.retirement_reason AS retirementReason,
          p.out_of_stock_confirmations AS outOfStockConfirmations,
          po.denylisted,
          po.force_retired AS forceRetired,
          po.force_watched AS forceWatched,
          po.known_employee_only AS knownEmployeeOnly
        FROM products p
        LEFT JOIN product_overrides po ON po.product_id = p.stable_id
        ${where.sql}
        ORDER BY ${sortColumn} ${sortDirection}, p.stable_id ASC
        LIMIT @limit OFFSET @offset
      `,
    )
    .all({
      ...where.parameters,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

  return {
    products: rows.map(mapProductListRow),
    page,
    pageSize,
    total: total ?? 0,
    totalPages: Math.max(1, Math.ceil((total ?? 0) / pageSize)),
  };
}

export function getDashboardProductDetail(
  database: Database.Database,
  stableId: string,
): DashboardProductDetail | null {
  const row = database
    .prepare<{ stableId: string }, ProductDetailSqlRow>(
      `
        SELECT
          p.stable_id AS stableId,
          p.name,
          p.url,
          p.image_url AS imageUrl,
          p.description,
          p.collection,
          p.price,
          p.normalized_snapshot_json AS normalizedSnapshotJson,
          p.raw_fingerprint AS rawFingerprint,
          p.buyable_state AS availabilityState,
          p.available_sizes_json AS availableSizesJson,
          p.first_seen_at AS firstSeenAt,
          p.last_seen_at AS lastSeenAt,
          p.first_public_at AS firstPublicAt,
          CASE WHEN p.retired_at IS NULL THEN 0 ELSE 1 END AS isRetired,
          p.retired_at AS retiredAt,
          p.retirement_reason AS retirementReason,
          p.out_of_stock_confirmations AS outOfStockConfirmations,
          po.denylisted,
          po.force_retired AS forceRetired,
          po.force_watched AS forceWatched,
          po.known_employee_only AS knownEmployeeOnly,
          po.annotation
        FROM products p
        LEFT JOIN product_overrides po ON po.product_id = p.stable_id
        WHERE p.stable_id = @stableId
      `,
    )
    .get({ stableId });

  if (!row) {
    return null;
  }

  return {
    ...mapProductListRow(row),
    sourceUrl: row.url,
    description: row.description,
    normalizedSnapshot: JSON.parse(row.normalizedSnapshotJson) as JsonObject,
    rawFingerprint: row.rawFingerprint,
    override: productOverrideFromDetailRow(row),
    recentEvents: findRecentProductEvents(database, stableId),
  };
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

function buildProductWhereClause(options: DashboardProductListOptions): {
  sql: string;
  parameters: Record<string, unknown>;
} {
  const clauses: string[] = [];
  const parameters: Record<string, unknown> = {};
  const watchStatus = options.watchStatus ?? "active";

  if (watchStatus === "active") {
    clauses.push("p.retired_at IS NULL");
  } else if (watchStatus === "retired") {
    clauses.push("p.retired_at IS NOT NULL");
  }

  if (options.search?.trim()) {
    clauses.push(
      "(p.stable_id LIKE @search OR p.name LIKE @search OR p.collection LIKE @search)",
    );
    parameters.search = `%${escapeLike(options.search.trim())}%`;
  }

  if (options.availabilityStates?.length) {
    const placeholders = options.availabilityStates.map((state, index) => {
      const key = `availabilityState${index}`;
      parameters[key] = state;
      return `@${key}`;
    });
    clauses.push(`p.buyable_state IN (${placeholders.join(", ")})`);
  }

  if (options.collection?.trim()) {
    clauses.push("p.collection = @collection");
    parameters.collection = options.collection.trim();
  }

  if (options.notificationRelevant) {
    clauses.push(`
      (
        p.buyable_state = 'publicly_buyable'
        OR p.first_public_at IS NOT NULL
        OR EXISTS (
          SELECT 1
          FROM events e
          WHERE e.product_id = p.stable_id
            AND e.notification_status IN ('pending', 'failed')
        )
      )
    `);
  }

  return {
    sql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    parameters,
  };
}

function escapeLike(value: string): string {
  return value.replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function mapProductListRow(row: ProductListSqlRow): DashboardProductRow {
  return {
    stableId: row.stableId,
    name: row.name,
    url: row.url,
    imageUrl: row.imageUrl,
    collection: row.collection,
    price: row.price,
    availabilityState: row.availabilityState,
    availableSizes: JSON.parse(row.availableSizesJson) as string[],
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
    firstPublicAt: row.firstPublicAt,
    isRetired: Boolean(row.isRetired),
    retiredAt: row.retiredAt,
    retirementReason: row.retirementReason,
    outOfStockConfirmations: row.outOfStockConfirmations,
    overrideBadges: overrideBadges(row),
  };
}

function overrideBadges(row: ProductListSqlRow): string[] {
  const badges: string[] = [];

  if (row.denylisted) {
    badges.push("denylisted");
  }
  if (row.forceRetired) {
    badges.push("force retired");
  }
  if (row.forceWatched) {
    badges.push("force watched");
  }
  if (row.knownEmployeeOnly) {
    badges.push("known employee only");
  }

  return badges;
}

function productOverrideFromDetailRow(
  row: ProductDetailSqlRow,
): ProductOverride | null {
  if (
    row.denylisted === null &&
    row.forceRetired === null &&
    row.forceWatched === null &&
    row.knownEmployeeOnly === null &&
    row.annotation === null
  ) {
    return null;
  }

  return {
    productId: row.stableId,
    denylisted: Boolean(row.denylisted),
    forceRetired: Boolean(row.forceRetired),
    forceWatched: Boolean(row.forceWatched),
    knownEmployeeOnly: Boolean(row.knownEmployeeOnly),
    annotation: row.annotation,
  };
}

function findRecentProductEvents(
  database: Database.Database,
  stableId: string,
): DashboardProductEvent[] {
  return database
    .prepare<{ stableId: string }, ProductEventSqlRow>(
      `
        SELECT
          id,
          event_type AS eventType,
          payload_json AS payloadJson,
          notification_status AS notificationStatus,
          attempt_count AS attemptCount,
          last_attempt_at AS lastAttemptAt,
          notification_error AS notificationError,
          created_at AS createdAt,
          notified_at AS notifiedAt
        FROM events
        WHERE product_id = @stableId
        ORDER BY created_at DESC, id DESC
        LIMIT 25
      `,
    )
    .all({ stableId })
    .map((row) => ({
      id: row.id,
      eventType: row.eventType,
      payload: JSON.parse(row.payloadJson) as JsonObject,
      notificationStatus: row.notificationStatus,
      attemptCount: row.attemptCount,
      lastAttemptAt: row.lastAttemptAt,
      notificationError: row.notificationError,
      createdAt: row.createdAt,
      notifiedAt: row.notifiedAt,
    }));
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

function buildEventWhereClause(options: DashboardEventListOptions): {
  sql: string;
  parameters: Record<string, unknown>;
} {
  const clauses: string[] = [];
  const parameters: Record<string, unknown> = {};

  if (options.eventType?.trim()) {
    clauses.push("e.event_type = @eventType");
    parameters.eventType = options.eventType.trim();
  }
  if (options.notificationStatus) {
    clauses.push("e.notification_status = @notificationStatus");
    parameters.notificationStatus = options.notificationStatus;
  }
  if (options.productId?.trim()) {
    clauses.push("e.product_id = @productId");
    parameters.productId = options.productId.trim();
  }

  return {
    sql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    parameters,
  };
}

function countEvents(
  database: Database.Database,
  where: { sql: string; parameters: Record<string, unknown> },
): number {
  return (
    database
      .prepare<Record<string, unknown>, CountRow>(
        `
          SELECT COUNT(*) AS count
          FROM events e
          ${where.sql}
        `,
      )
      .get(where.parameters)?.count ?? 0
  );
}

function mapDashboardEventRow(row: EventSqlRow): DashboardEventRow {
  return {
    id: row.id,
    eventType: row.eventType,
    productId: row.productId,
    productName: row.productName,
    notificationStatus: row.notificationStatus,
    attemptCount: row.attemptCount,
    lastAttemptAt: row.lastAttemptAt,
    createdAt: row.createdAt,
    notifiedAt: row.notifiedAt,
    hasPayload: row.payloadJson !== "{}",
    hasNotificationError: Boolean(row.notificationError),
  };
}

function eventSortExpression(sortBy: DashboardEventSortBy): string {
  return EVENT_SORT_EXPRESSIONS[sortBy];
}

function normalizeEventSortBy(
  sortBy: DashboardEventSortBy | undefined,
): DashboardEventSortBy {
  switch (sortBy) {
    case "attemptCount":
    case "eventType":
    case "notificationStatus":
    case "notifiedAt":
    case "createdAt":
      return sortBy;
    default:
      return DEFAULT_EVENT_SORT_BY;
  }
}

function normalizeEventSortDirection(
  sortDirection: DashboardSortDirection | undefined,
): DashboardSortDirection {
  return sortDirection === "asc" ? "asc" : DEFAULT_EVENT_SORT_DIRECTION;
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

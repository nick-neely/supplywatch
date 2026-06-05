import type {
  DashboardEventSortBy,
  DashboardProductSort,
  DashboardRunSortBy,
  RunStatus,
} from "@supplywatch/state";
import type { EventsTableState, RunsTableState } from "@/client/types";

export const DEFAULT_REFRESH_INTERVAL_MS = 15_000;
export const DEFAULT_PRODUCT_PAGE_SIZE = 50;
export const DEFAULT_PRODUCT_SORT: DashboardProductSort = {
  field: "lastSeenAt",
  direction: "desc",
};

export const RUN_STATUSES = [
  "running",
  "completed",
  "failed",
] as const satisfies readonly RunStatus[];

export const RUN_SORT_COLUMNS = [
  "status",
  "startedAt",
  "finishedAt",
  "productCount",
] as const satisfies readonly DashboardRunSortBy[];

export const RUN_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export const EVENT_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export const EVENT_SORT_COLUMNS = [
  "createdAt",
  "notifiedAt",
  "eventType",
  "notificationStatus",
  "attemptCount",
] as const satisfies readonly DashboardEventSortBy[];

export const DEFAULT_RUNS_TABLE_STATE: RunsTableState = {
  sortBy: "startedAt",
  sortDirection: "desc",
  page: 1,
  pageSize: 25,
};

export const DEFAULT_EVENTS_TABLE_STATE: EventsTableState = {
  sortBy: "createdAt",
  sortDirection: "desc",
  page: 1,
  pageSize: 50,
};

import type { DashboardRunSortBy, RunStatus } from "@supplywatch/state";
import {
  DEFAULT_RUNS_TABLE_STATE,
  RUN_SORT_COLUMNS,
  RUN_STATUSES,
} from "@/client/constants";
import type { RunsTableState } from "@/client/types";

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseRunStatus(value: string | null): RunStatus | undefined {
  if (isRunStatus(value)) {
    return value;
  }

  return undefined;
}

export function parseRunSort(
  value: string | null | undefined,
): DashboardRunSortBy {
  if (isRunSort(value)) {
    return value;
  }

  return DEFAULT_RUNS_TABLE_STATE.sortBy;
}

export function isRunSort(
  value: string | null | undefined,
): value is DashboardRunSortBy {
  return RUN_SORT_COLUMNS.some((column) => column === value);
}

function isRunStatus(value: string | null): value is RunStatus {
  return RUN_STATUSES.some((status) => status === value);
}

export function parseRunsTableState(search: string): RunsTableState {
  const params = new URLSearchParams(search);

  return {
    status: parseRunStatus(params.get("status")),
    sortBy: parseRunSort(params.get("sort")),
    sortDirection: params.get("direction") === "asc" ? "asc" : "desc",
    page: parsePositiveInteger(
      params.get("page"),
      DEFAULT_RUNS_TABLE_STATE.page,
    ),
    pageSize: parsePositiveInteger(
      params.get("pageSize"),
      DEFAULT_RUNS_TABLE_STATE.pageSize,
    ),
  };
}

export function serializeRunsTableState(state: RunsTableState): string {
  const params = new URLSearchParams();
  if (state.status) {
    params.set("status", state.status);
  }
  params.set("sort", state.sortBy);
  params.set("direction", state.sortDirection);
  params.set("page", String(state.page));
  params.set("pageSize", String(state.pageSize));
  return params.toString();
}

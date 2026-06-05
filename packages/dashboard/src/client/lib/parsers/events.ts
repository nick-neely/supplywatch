import type {
  DashboardEventSortBy,
  NotificationStatus,
} from "@supplywatch/state";
import { NOTIFICATION_STATUSES } from "@supplywatch/state/types";
import {
  DEFAULT_EVENTS_TABLE_STATE,
  EVENT_SORT_COLUMNS,
} from "@/client/constants";
import type { EventsTableState } from "@/client/types";

function optionalParam(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseNotificationStatus(
  value: string | null,
): NotificationStatus | undefined {
  if (isNotificationStatus(value)) {
    return value;
  }

  return undefined;
}

export function parseEventSort(
  value: string | null | undefined,
): DashboardEventSortBy {
  if (isEventSort(value)) {
    return value;
  }

  return DEFAULT_EVENTS_TABLE_STATE.sortBy;
}

export function isEventSort(
  value: string | null | undefined,
): value is DashboardEventSortBy {
  return EVENT_SORT_COLUMNS.some((column) => column === value);
}

function isNotificationStatus(
  value: string | null,
): value is NotificationStatus {
  return NOTIFICATION_STATUSES.some((status) => status === value);
}

export function parseEventsTableState(search: string): EventsTableState {
  const params = new URLSearchParams(search);

  return {
    eventType: optionalParam(params.get("eventType")),
    notificationStatus: parseNotificationStatus(
      params.get("notificationStatus"),
    ),
    productId: optionalParam(params.get("productId")),
    sortBy: parseEventSort(params.get("sort")),
    sortDirection: params.get("direction") === "asc" ? "asc" : "desc",
    page: parsePositiveInteger(
      params.get("page"),
      DEFAULT_EVENTS_TABLE_STATE.page,
    ),
    pageSize: parsePositiveInteger(
      params.get("pageSize"),
      DEFAULT_EVENTS_TABLE_STATE.pageSize,
    ),
  };
}

export function serializeEventsTableState(state: EventsTableState): string {
  const params = new URLSearchParams();
  if (state.eventType) {
    params.set("eventType", state.eventType);
  }
  if (state.notificationStatus) {
    params.set("notificationStatus", state.notificationStatus);
  }
  if (state.productId) {
    params.set("productId", state.productId);
  }
  params.set("sort", state.sortBy);
  params.set("direction", state.sortDirection);
  params.set("page", String(state.page));
  params.set("pageSize", String(state.pageSize));
  return params.toString();
}

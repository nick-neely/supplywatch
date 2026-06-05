import type {
  BuyableState,
  DashboardProductListOptions,
  DashboardProductSort,
  DashboardProductSortField,
  DashboardProductWatchStatus,
} from "@supplywatch/state";
import {
  DASHBOARD_PRODUCT_SORT_FIELDS,
  DASHBOARD_PRODUCT_WATCH_STATUSES,
} from "@supplywatch/state/dashboard";
import { BUYABLE_STATES } from "@supplywatch/state/types";
import { DEFAULT_PRODUCT_PAGE_SIZE } from "@/client/constants";

function optionalParam(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function positiveInteger(value: string | null): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function parseWatchStatus(
  value: string | null,
): DashboardProductWatchStatus | undefined {
  for (const status of DASHBOARD_PRODUCT_WATCH_STATUSES) {
    if (value === status) {
      return status;
    }
  }

  return undefined;
}

export function selectedAvailabilityStates(value: string): BuyableState[] {
  return value.split(",").flatMap((state) => {
    const parsed = BUYABLE_STATES.find((entry) => entry === state);
    return parsed ? [parsed] : [];
  });
}

export function productSort(
  value: string | null,
): DashboardProductSort | undefined {
  const [field, direction] = value?.split(".") ?? [];

  if (!isProductSortField(field)) {
    return undefined;
  }

  return {
    field,
    direction: direction === "asc" ? "asc" : "desc",
  };
}

export function productSortParam(sort: DashboardProductSort): string {
  return `${sort.field}.${sort.direction}`;
}

export function isProductSortField(
  value: string | undefined,
): value is DashboardProductSortField {
  return DASHBOARD_PRODUCT_SORT_FIELDS.some((field) => field === value);
}

export function parseProductListOptions(): DashboardProductListOptions {
  const searchParams = new URLSearchParams(window.location.search);

  return {
    search: optionalParam(searchParams.get("search")),
    availabilityStates: searchParams
      .getAll("availability")
      .flatMap((value) => selectedAvailabilityStates(value)),
    watchStatus: parseWatchStatus(searchParams.get("watchStatus")) ?? "active",
    collection: optionalParam(searchParams.get("collection")),
    notificationRelevant:
      searchParams.get("notificationRelevant") === "true" ? true : undefined,
    sort: productSort(searchParams.get("sort")),
    page: positiveInteger(searchParams.get("page")) ?? 1,
    pageSize:
      positiveInteger(searchParams.get("pageSize")) ??
      DEFAULT_PRODUCT_PAGE_SIZE,
  };
}

export function productListSearchParams(
  options: DashboardProductListOptions,
): URLSearchParams {
  const searchParams = new URLSearchParams();

  if (options.search) {
    searchParams.set("search", options.search);
  }
  for (const state of options.availabilityStates ?? []) {
    searchParams.append("availability", state);
  }
  if (options.watchStatus) {
    searchParams.set("watchStatus", options.watchStatus);
  }
  if (options.collection) {
    searchParams.set("collection", options.collection);
  }
  if (options.notificationRelevant) {
    searchParams.set("notificationRelevant", "true");
  }
  if (options.sort) {
    searchParams.set("sort", productSortParam(options.sort));
  }
  if (options.page) {
    searchParams.set("page", String(options.page));
  }
  if (options.pageSize) {
    searchParams.set("pageSize", String(options.pageSize));
  }

  return searchParams;
}

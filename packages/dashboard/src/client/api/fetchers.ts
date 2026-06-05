import type {
  DashboardEventDetail,
  DashboardEventList,
  DashboardProductDetail,
  DashboardProductListOptions,
  DashboardProductPage,
  DashboardRunList,
  DashboardRunRow,
  WatcherDashboardSummary,
} from "@supplywatch/state";
import { serializeEventsTableState } from "@/client/lib/parsers/events";
import { productListSearchParams } from "@/client/lib/parsers/products";
import { serializeRunsTableState } from "@/client/lib/parsers/runs";
import type {
  EventDetailFetcher,
  EventsFetcher,
  EventsTableState,
  ProductDetailFetcher,
  ProductListFetcher,
  RunDetailFetcher,
  RunsFetcher,
  RunsTableState,
  SummaryFetcher,
} from "@/client/types";

export const fetchSummaryFromApi: SummaryFetcher = async () => {
  const response = await fetch("/api/summary");

  if (!response.ok) {
    throw new Error(`Summary request failed with HTTP ${response.status}`);
  }

  return (await response.json()) as WatcherDashboardSummary;
};

export const fetchProductsFromApi: ProductListFetcher = async (
  options: DashboardProductListOptions,
) => {
  const response = await fetch(
    `/api/products?${productListSearchParams(options)}`,
  );

  if (!response.ok) {
    throw new Error(`Products request failed with HTTP ${response.status}`);
  }

  return (await response.json()) as DashboardProductPage;
};

export const fetchProductDetailFromApi: ProductDetailFetcher = async (
  stableId: string,
) => {
  const response = await fetch(`/api/products/${encodeURIComponent(stableId)}`);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Product request failed with HTTP ${response.status}`);
  }

  return (await response.json()) as DashboardProductDetail;
};

export const fetchEventsFromApi: EventsFetcher = async (
  state: EventsTableState,
) => {
  const response = await fetch(
    `/api/events?${serializeEventsTableState(state)}`,
  );

  if (!response.ok) {
    throw new Error(`Events request failed with HTTP ${response.status}`);
  }

  return (await response.json()) as DashboardEventList;
};

export const fetchEventDetailFromApi: EventDetailFetcher = async (
  eventId: number,
) => {
  const response = await fetch(`/api/events/${eventId}`);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Event request failed with HTTP ${response.status}`);
  }

  return (await response.json()) as DashboardEventDetail;
};

export const fetchRunsFromApi: RunsFetcher = async (state: RunsTableState) => {
  const response = await fetch(`/api/runs?${serializeRunsTableState(state)}`);

  if (!response.ok) {
    throw new Error(`Runs request failed with HTTP ${response.status}`);
  }

  return (await response.json()) as DashboardRunList;
};

export const fetchRunDetailFromApi: RunDetailFetcher = async (
  runId: number,
) => {
  const response = await fetch(`/api/runs/${runId}`);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Run request failed with HTTP ${response.status}`);
  }

  return (await response.json()) as DashboardRunRow;
};

import type {
  DashboardEventDetail,
  DashboardEventList,
  DashboardEventSortBy,
  DashboardProductDetail,
  DashboardProductListOptions,
  DashboardProductPage,
  DashboardRunList,
  DashboardRunRow,
  DashboardRunSortBy,
  DashboardSortDirection,
  NotificationStatus,
  RunStatus,
  WatcherDashboardSummary,
} from "@supplywatch/state";

export type SummaryFetcher = () => Promise<WatcherDashboardSummary>;
export type ProductListFetcher = (
  options: DashboardProductListOptions,
) => Promise<DashboardProductPage>;
export type ProductDetailFetcher = (
  stableId: string,
) => Promise<DashboardProductDetail | null>;
export type EventsFetcher = (
  state: EventsTableState,
) => Promise<DashboardEventList>;
export type EventDetailFetcher = (
  eventId: number,
) => Promise<DashboardEventDetail | null>;
export type RunsFetcher = (state: RunsTableState) => Promise<DashboardRunList>;
export type RunDetailFetcher = (
  runId: number,
) => Promise<DashboardRunRow | null>;

export type AppProps = {
  fetchSummary?: SummaryFetcher;
  fetchProducts?: ProductListFetcher;
  fetchProductDetail?: ProductDetailFetcher;
  fetchEvents?: EventsFetcher;
  fetchEventDetail?: EventDetailFetcher;
  fetchRuns?: RunsFetcher;
  fetchRunDetail?: RunDetailFetcher;
  refreshIntervalMs?: number;
};

export type RunsTableState = {
  status?: RunStatus;
  sortBy: DashboardRunSortBy;
  sortDirection: DashboardSortDirection;
  page: number;
  pageSize: number;
};

export type EventsTableState = {
  eventType?: string;
  notificationStatus?: NotificationStatus;
  productId?: string;
  sortBy: DashboardEventSortBy;
  sortDirection: DashboardSortDirection;
  page: number;
  pageSize: number;
};

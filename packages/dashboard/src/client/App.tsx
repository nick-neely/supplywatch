import type {
  BuyableState,
  DashboardEventDetail,
  DashboardEventList,
  DashboardEventRow,
  DashboardEventSortBy,
  DashboardProductDetail,
  DashboardProductListOptions,
  DashboardProductPage,
  DashboardProductRow,
  DashboardProductSort,
  DashboardProductSortField,
  DashboardProductWatchStatus,
  DashboardRunList,
  DashboardRunRow,
  DashboardRunSortBy,
  DashboardSortDirection,
  NotificationStatus,
  RunStatus,
  WatcherDashboardSummary,
} from "@supplywatch/state";
import {
  DASHBOARD_PRODUCT_SORT_FIELDS,
  DASHBOARD_PRODUCT_WATCH_STATUSES,
} from "@supplywatch/state/dashboard";
import {
  BUYABLE_STATES,
  NOTIFICATION_STATUSES,
} from "@supplywatch/state/types";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type Table as ReactTable,
  type RowData,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";

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

const DEFAULT_REFRESH_INTERVAL_MS = 15_000;
const DEFAULT_PRODUCT_PAGE_SIZE = 50;
const DEFAULT_PRODUCT_SORT: DashboardProductSort = {
  field: "lastSeenAt",
  direction: "desc",
};
const RUN_STATUSES = [
  "running",
  "completed",
  "failed",
] as const satisfies readonly RunStatus[];
const RUN_SORT_COLUMNS = [
  "status",
  "startedAt",
  "finishedAt",
  "productCount",
] as const satisfies readonly DashboardRunSortBy[];
const RUN_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const EVENT_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const EVENT_SORT_COLUMNS = [
  "createdAt",
  "notifiedAt",
  "eventType",
  "notificationStatus",
  "attemptCount",
] as const satisfies readonly DashboardEventSortBy[];
const DEFAULT_RUNS_TABLE_STATE: RunsTableState = {
  sortBy: "startedAt",
  sortDirection: "desc",
  page: 1,
  pageSize: 25,
};
const DEFAULT_EVENTS_TABLE_STATE: EventsTableState = {
  sortBy: "createdAt",
  sortDirection: "desc",
  page: 1,
  pageSize: 50,
};

export function App({
  fetchSummary = fetchSummaryFromApi,
  fetchProducts = fetchProductsFromApi,
  fetchProductDetail = fetchProductDetailFromApi,
  fetchEvents = fetchEventsFromApi,
  fetchEventDetail = fetchEventDetailFromApi,
  fetchRuns = fetchRunsFromApi,
  fetchRunDetail = fetchRunDetailFromApi,
  refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS,
}: AppProps) {
  const route = useRoute();

  return (
    <main className="dashboard-shell">
      <nav className="dashboard-nav" aria-label="Dashboard navigation">
        <a
          href="/products"
          className={route.pathname.startsWith("/products") ? "active" : ""}
        >
          Products
        </a>
        <a
          href="/events"
          className={route.pathname.startsWith("/events") ? "active" : ""}
        >
          Events
        </a>
        <a
          href="/runs"
          className={route.pathname.startsWith("/runs") ? "active" : ""}
        >
          Runs
        </a>
        <a
          href="/summary"
          className={route.pathname === "/summary" ? "active" : ""}
        >
          Summary
        </a>
      </nav>

      {renderRoute(route.pathname, {
        fetchSummary,
        fetchProducts,
        fetchProductDetail,
        fetchEvents,
        fetchEventDetail,
        fetchRuns,
        fetchRunDetail,
        refreshIntervalMs,
      })}
    </main>
  );
}

function renderRoute(pathname: string, props: Required<AppProps>): ReactNode {
  if (pathname === "/summary") {
    return (
      <SummaryPage
        fetchSummary={props.fetchSummary}
        refreshIntervalMs={props.refreshIntervalMs}
      />
    );
  }

  if (pathname.startsWith("/products/")) {
    return (
      <ProductDetailPage
        fetchProductDetail={props.fetchProductDetail}
        refreshIntervalMs={props.refreshIntervalMs}
        stableId={decodeURIComponent(pathname.replace("/products/", ""))}
      />
    );
  }

  if (pathname === "/runs") {
    return (
      <RunsPage
        fetchRuns={props.fetchRuns}
        refreshIntervalMs={props.refreshIntervalMs}
      />
    );
  }

  if (pathname === "/events") {
    return (
      <EventsPage
        fetchEvents={props.fetchEvents}
        refreshIntervalMs={props.refreshIntervalMs}
      />
    );
  }

  if (pathname.startsWith("/events/")) {
    return (
      <EventDetailPage
        fetchEventDetail={props.fetchEventDetail}
        eventId={Number(pathname.replace("/events/", ""))}
        refreshIntervalMs={props.refreshIntervalMs}
      />
    );
  }

  if (pathname.startsWith("/runs/")) {
    return (
      <RunDetailPage
        fetchRunDetail={props.fetchRunDetail}
        refreshIntervalMs={props.refreshIntervalMs}
        runId={Number(pathname.replace("/runs/", ""))}
      />
    );
  }

  return (
    <ProductsPage
      fetchProducts={props.fetchProducts}
      refreshIntervalMs={props.refreshIntervalMs}
    />
  );
}

function useRoute(): { pathname: string; search: string } {
  const [route, setRoute] = useState(() => ({
    pathname: window.location.pathname,
    search: window.location.search,
  }));

  useEffect(() => {
    const updateRoute = () =>
      setRoute({
        pathname: window.location.pathname,
        search: window.location.search,
      });

    window.addEventListener("popstate", updateRoute);
    window.addEventListener("supplywatch:navigate", updateRoute);

    return () => {
      window.removeEventListener("popstate", updateRoute);
      window.removeEventListener("supplywatch:navigate", updateRoute);
    };
  }, []);

  return route;
}

function navigateTo(url: string): void {
  window.history.pushState({}, "", url);
  window.dispatchEvent(new Event("supplywatch:navigate"));
}

function useDashboardRefresh(
  refresh: () => Promise<void>,
  refreshIntervalMs: number,
): void {
  useEffect(() => {
    void refresh();

    if (refreshIntervalMs <= 0) {
      return;
    }

    const interval = window.setInterval(() => {
      void refresh();
    }, refreshIntervalMs);

    return () => window.clearInterval(interval);
  }, [refresh, refreshIntervalMs]);
}

const PRODUCT_TABLE_COLUMNS: ColumnDef<DashboardProductRow>[] = [
  {
    accessorKey: "name",
    header: "Product",
    cell: ({ row }) => <ProductIdentity product={row.original} />,
  },
  {
    accessorKey: "collection",
    header: "Collection",
    cell: ({ row }) => row.original.collection ?? "none",
  },
  {
    accessorKey: "price",
    header: "Price",
    cell: ({ row }) => row.original.price ?? "none",
  },
  {
    accessorKey: "availabilityState",
    header: "Availability state",
    cell: ({ row }) => (
      <StatusChip value={availabilityLabel(row.original.availabilityState)} />
    ),
  },
  {
    accessorKey: "availableSizes",
    header: "Sizes",
    cell: ({ row }) =>
      row.original.availableSizes.length > 0
        ? row.original.availableSizes.join(", ")
        : "none",
  },
  {
    accessorKey: "lastSeenAt",
    header: "Last seen",
    cell: ({ row }) => formatTimestamp(row.original.lastSeenAt),
  },
  {
    accessorKey: "firstSeenAt",
    header: "First seen",
    cell: ({ row }) => formatTimestamp(row.original.firstSeenAt),
  },
  {
    accessorKey: "isRetired",
    header: "Watch status",
    cell: ({ row }) => (row.original.isRetired ? "retired" : "active"),
  },
  {
    accessorKey: "overrideBadges",
    header: "Product overrides",
    cell: ({ row }) =>
      row.original.overrideBadges.length > 0 ? (
        <ChipList values={row.original.overrideBadges} />
      ) : (
        "none"
      ),
  },
];

function ProductsPage({
  fetchProducts,
  refreshIntervalMs,
}: {
  fetchProducts: ProductListFetcher;
  refreshIntervalMs: number;
}) {
  const [options, setOptions] = useState(parseProductListOptions);
  const [page, setPage] = useState<DashboardProductPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      setPage(await fetchProducts(options));
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchProducts, options]);

  useDashboardRefresh(refresh, refreshIntervalMs);

  const updateOptions = (next: DashboardProductListOptions) => {
    setOptions(next);
    navigateTo(`/products?${productListSearchParams(next).toString()}`);
  };

  const table = useReactTable({
    data: page?.products ?? [],
    columns: PRODUCT_TABLE_COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  return (
    <>
      <header className="dashboard-header">
        <div>
          <p className="ledger-label">Watcher dashboard</p>
          <h1>Products</h1>
        </div>
        <button type="button" onClick={() => void refresh()}>
          {isRefreshing ? "Refreshing..." : "Refresh Products"}
        </button>
      </header>

      <section className="product-toolbar" aria-label="Product filters">
        <label>
          Search
          <input
            name="product-search"
            value={options.search ?? ""}
            onInput={(event) =>
              updateOptions({
                ...options,
                search: event.currentTarget.value || undefined,
                page: 1,
              })
            }
          />
        </label>
        <label>
          Collection
          <input
            name="product-collection"
            value={options.collection ?? ""}
            onInput={(event) =>
              updateOptions({
                ...options,
                collection: event.currentTarget.value || undefined,
                page: 1,
              })
            }
          />
        </label>
        <label>
          Availability state
          <select
            value={options.availabilityStates?.[0] ?? ""}
            onChange={(event) =>
              updateOptions({
                ...options,
                availabilityStates: selectedAvailabilityStates(
                  event.currentTarget.value,
                ),
                page: 1,
              })
            }
          >
            <option value="">All</option>
            {BUYABLE_STATES.map((state) => (
              <option key={state} value={state}>
                {availabilityLabel(state)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Watch status
          <select
            value={options.watchStatus ?? "active"}
            onChange={(event) =>
              updateOptions({
                ...options,
                watchStatus: watchStatus(event.currentTarget.value),
                page: 1,
              })
            }
          >
            <option value="active">Active</option>
            <option value="retired">Retired</option>
            <option value="all">All</option>
          </select>
        </label>
        <label>
          Sort
          <select
            value={
              options.sort
                ? productSortParam(options.sort)
                : productSortParam(DEFAULT_PRODUCT_SORT)
            }
            onChange={(event) =>
              updateOptions({
                ...options,
                sort: productSort(event.currentTarget.value),
                page: 1,
              })
            }
          >
            <option value="lastSeenAt.desc">Last seen, newest</option>
            <option value="lastSeenAt.asc">Last seen, oldest</option>
            <option value="firstSeenAt.desc">First seen, newest</option>
            <option value="name.asc">Name, A to Z</option>
            <option value="collection.asc">Collection, A to Z</option>
            <option value="availabilityState.asc">Availability state</option>
          </select>
        </label>
        <label className="checkbox-label">
          <input
            checked={options.notificationRelevant ?? false}
            type="checkbox"
            onChange={(event) =>
              updateOptions({
                ...options,
                notificationRelevant: event.currentTarget.checked || undefined,
                page: 1,
              })
            }
          />
          Notification relevant
        </label>
      </section>

      {error ? <p className="error-panel">{error}</p> : null}

      {page ? (
        <>
          <VirtualizedTable rowHeight={72} table={table} />
          <footer className="table-footer">
            <span>
              Page {page.page} of {page.totalPages}, {page.total} Products
            </span>
            <span className="pagination-controls">
              <button
                className="ghost-button"
                disabled={page.page <= 1}
                type="button"
                onClick={() =>
                  updateOptions({
                    ...options,
                    page: Math.max(1, page.page - 1),
                  })
                }
              >
                Previous page
              </button>
              <button
                className="ghost-button"
                disabled={page.page >= page.totalPages}
                type="button"
                onClick={() =>
                  updateOptions({
                    ...options,
                    page: Math.min(page.totalPages, page.page + 1),
                  })
                }
              >
                Next page
              </button>
            </span>
          </footer>
        </>
      ) : (
        <section className="skeleton-table" aria-label="Loading Products" />
      )}
    </>
  );
}

function VirtualizedTable<TData extends RowData>({
  rowHeight,
  table,
}: {
  rowHeight: number;
  table: ReactTable<TData>;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const visibleRows =
    virtualRows.length > 0
      ? virtualRows.map((virtualRow) => ({
          row: rows[virtualRow.index],
          transform: `translateY(${virtualRow.start}px)`,
        }))
      : rows.map((row, index) => ({
          row,
          transform: `translateY(${index * rowHeight}px)`,
        }));

  return (
    <div className="table-viewport" ref={parentRef}>
      <DashboardTable
        style={{ minHeight: `${Math.max(rows.length, 1) * rowHeight}px` }}
      >
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {visibleRows.map(({ row, transform }) =>
            row ? (
              <tr key={row.id} style={{ transform }}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ) : null,
          )}
        </tbody>
      </DashboardTable>
    </div>
  );
}

function ProductDetailPage({
  fetchProductDetail,
  refreshIntervalMs,
  stableId,
}: {
  fetchProductDetail: ProductDetailFetcher;
  refreshIntervalMs: number;
  stableId: string;
}) {
  const [product, setProduct] = useState<DashboardProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSnapshotOpen, setIsSnapshotOpen] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const product = await fetchProductDetail(stableId);
      setProduct(product);
      setError(product ? null : "Product not found");
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchProductDetail, stableId]);

  useDashboardRefresh(refresh, refreshIntervalMs);

  if (error) {
    return <p className="error-panel">{error}</p>;
  }

  if (!product) {
    return <section className="skeleton-panel" aria-label="Loading Product" />;
  }

  return (
    <>
      <header className="dashboard-header detail-header">
        <div>
          <a className="back-link" href="/products">
            Back to Products
          </a>
          <h1>{product.name ?? product.stableId}</h1>
          <p className="muted-text">{product.stableId}</p>
        </div>
        {product.sourceUrl ? (
          <a
            className="source-link"
            href={product.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open source
          </a>
        ) : null}
        <button type="button" onClick={() => void refresh()}>
          {isRefreshing ? "Refreshing..." : "Refresh Product"}
        </button>
      </header>

      <section className="detail-grid">
        <ProductImage product={product} />
        <article className="detail-panel">
          <h2>Curated state</h2>
          <dl>
            <DetailField label="Availability state">
              <StatusChip
                value={availabilityLabel(product.availabilityState)}
              />
            </DetailField>
            <DetailField label="Collection">
              {product.collection ?? "none"}
            </DetailField>
            <DetailField label="Price">{product.price ?? "none"}</DetailField>
            <DetailField label="Available sizes">
              {product.availableSizes.length > 0
                ? product.availableSizes.join(", ")
                : "none"}
            </DetailField>
            <DetailField label="First seen">
              {formatTimestamp(product.firstSeenAt)}
            </DetailField>
            <DetailField label="Last seen">
              {formatTimestamp(product.lastSeenAt)}
            </DetailField>
            <DetailField label="First public">
              {formatTimestamp(product.firstPublicAt)}
            </DetailField>
            <DetailField label="Out-of-stock confirmations">
              {product.outOfStockConfirmations}
            </DetailField>
            <DetailField label="Watch status">
              {product.isRetired ? "retired" : "active"}
            </DetailField>
          </dl>
        </article>
      </section>

      <section className="detail-columns">
        <article className="detail-panel">
          <h2>Product overrides</h2>
          {product.override ? (
            <>
              <ChipList values={product.overrideBadges} />
              {product.override.annotation ? (
                <p>{product.override.annotation}</p>
              ) : null}
            </>
          ) : (
            <p className="muted-text">No Product override is recorded.</p>
          )}
        </article>

        <article className="detail-panel">
          <h2>Recent Product Events</h2>
          {product.recentEvents.length > 0 ? (
            <ul className="event-list">
              {product.recentEvents.map((event) => (
                <li key={event.id}>
                  <span>{event.eventType}</span>
                  <strong>{event.notificationStatus}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted-text">No recent Product Events.</p>
          )}
        </article>
      </section>

      <section className="detail-panel evidence-panel">
        <button
          className="ghost-button"
          type="button"
          onClick={() => setIsSnapshotOpen((open) => !open)}
        >
          Snapshot and fingerprint
        </button>
        {isSnapshotOpen ? (
          <pre>
            {JSON.stringify(
              {
                normalizedSnapshot: product.normalizedSnapshot,
                rawFingerprint: product.rawFingerprint,
              },
              null,
              2,
            )}
          </pre>
        ) : null}
      </section>
    </>
  );
}

function EventsPage({
  fetchEvents,
  refreshIntervalMs,
}: {
  fetchEvents: EventsFetcher;
  refreshIntervalMs: number;
}) {
  const [tableState, setTableState] = useState(() =>
    parseEventsTableState(window.location.search),
  );
  const [events, setEvents] = useState<DashboardEventList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      setEvents(await fetchEvents(tableState));
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchEvents, tableState]);

  useDashboardRefresh(refresh, refreshIntervalMs);

  const updateTableState = (next: Partial<EventsTableState>) => {
    const updated = { ...tableState, ...next };
    setTableState(updated);
    navigateTo(`/events?${serializeEventsTableState(updated)}`);
  };

  return (
    <>
      <header className="dashboard-header">
        <div>
          <p className="ledger-label">Watcher dashboard</p>
          <h1>Events</h1>
        </div>
        <button type="button" onClick={() => void refresh()}>
          {isRefreshing ? "Refreshing..." : "Refresh Events"}
        </button>
      </header>

      <section className="product-toolbar" aria-label="Event filters">
        <label>
          Event type
          <input
            name="event-type"
            value={tableState.eventType ?? ""}
            onInput={(event) =>
              updateTableState({
                eventType: event.currentTarget.value || undefined,
                page: 1,
              })
            }
          />
        </label>
        <label>
          Product
          <input
            name="event-product"
            value={tableState.productId ?? ""}
            onInput={(event) =>
              updateTableState({
                productId: event.currentTarget.value || undefined,
                page: 1,
              })
            }
          />
        </label>
        <label>
          Notification status
          <select
            value={tableState.notificationStatus ?? "all"}
            onChange={(event) =>
              updateTableState({
                notificationStatus: parseNotificationStatus(
                  event.currentTarget.value,
                ),
                page: 1,
              })
            }
          >
            <option value="all">All statuses</option>
            {NOTIFICATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rows
          <select
            aria-label="Event rows per page"
            onChange={(event) =>
              updateTableState({
                pageSize: Number(event.currentTarget.value),
                page: 1,
              })
            }
            value={tableState.pageSize}
          >
            {EVENT_PAGE_SIZE_OPTIONS.map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select
            value={`${tableState.sortBy}.${tableState.sortDirection}`}
            onChange={(event) => {
              const [sortBy, sortDirection] =
                event.currentTarget.value.split(".");
              updateTableState({
                sortBy: parseEventSort(sortBy),
                sortDirection: sortDirection === "asc" ? "asc" : "desc",
                page: 1,
              });
            }}
          >
            <option value="createdAt.desc">Created, newest</option>
            <option value="createdAt.asc">Created, oldest</option>
            <option value="notifiedAt.desc">Notified, newest</option>
            <option value="eventType.asc">Event type</option>
            <option value="notificationStatus.asc">Notification status</option>
            <option value="attemptCount.desc">Attempt count</option>
          </select>
        </label>
      </section>

      {error ? <p className="error-panel">{error}</p> : null}

      {events ? (
        <>
          <EventsTable events={events.events} />
          <footer className="table-footer">
            <span>
              Page {events.pagination.page} of {events.pagination.totalPages},{" "}
              {events.pagination.totalItems} Events
            </span>
            <span className="pagination-controls">
              <button
                className="ghost-button"
                disabled={tableState.page <= 1}
                type="button"
                onClick={() =>
                  updateTableState({ page: Math.max(1, tableState.page - 1) })
                }
              >
                Previous page
              </button>
              <button
                className="ghost-button"
                disabled={tableState.page >= events.pagination.totalPages}
                type="button"
                onClick={() =>
                  updateTableState({
                    page: Math.min(
                      events.pagination.totalPages,
                      tableState.page + 1,
                    ),
                  })
                }
              >
                Next page
              </button>
            </span>
          </footer>
        </>
      ) : (
        <section className="skeleton-table" aria-label="Loading Events" />
      )}
    </>
  );
}

function EventsTable({ events }: { events: DashboardEventRow[] }) {
  const columns = useMemo<ColumnDef<DashboardEventRow>[]>(
    () => [
      {
        accessorKey: "eventType",
        header: "Event",
        cell: ({ row }) => (
          <span>
            <a href={`/events/${row.original.id}`}>{row.original.eventType}</a>
            {isCandidateSignalEvent(row.original.eventType) ? (
              <span className="stale-note">Candidate evidence</span>
            ) : null}
          </span>
        ),
      },
      {
        accessorKey: "productId",
        header: "Product",
        cell: ({ row }) => <EventProductLink event={row.original} />,
      },
      {
        accessorKey: "notificationStatus",
        header: "Notification",
        cell: ({ row }) => (
          <StatusChip value={row.original.notificationStatus} />
        ),
      },
      {
        accessorKey: "attemptCount",
        header: "Attempts",
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => formatTimestamp(row.original.createdAt),
      },
      {
        accessorKey: "notifiedAt",
        header: "Notified",
        cell: ({ row }) => formatTimestamp(row.original.notifiedAt),
      },
      {
        id: "details",
        header: "Details",
        cell: ({ row }) => (
          <span>
            {row.original.hasPayload ? "Payload" : "No payload"}
            {row.original.hasNotificationError ? ", error" : ""}
          </span>
        ),
      },
    ],
    [],
  );
  const table = useReactTable({
    data: events,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return <VirtualizedTable rowHeight={56} table={table} />;
}

function EventDetailPage({
  fetchEventDetail,
  eventId,
  refreshIntervalMs,
}: {
  fetchEventDetail: EventDetailFetcher;
  eventId: number;
  refreshIntervalMs: number;
}) {
  const [event, setEvent] = useState<DashboardEventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const event = await fetchEventDetail(eventId);
      setEvent(event);
      setError(event ? null : "Event not found");
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRefreshing(false);
    }
  }, [eventId, fetchEventDetail]);

  useDashboardRefresh(refresh, refreshIntervalMs);

  if (error) {
    return <p className="error-panel">{error}</p>;
  }

  if (!event) {
    return <section className="skeleton-panel" aria-label="Loading Event" />;
  }

  return (
    <section className="detail-layout" aria-label={`Event ${event.id} detail`}>
      <div className="detail-actions">
        <a className="back-link" href="/events">
          Back to Events
        </a>
        <button type="button" onClick={() => void refresh()}>
          {isRefreshing ? "Refreshing..." : "Refresh Event"}
        </button>
      </div>
      <article className="detail-panel">
        <div className="detail-title">
          <h2>Event #{event.id}</h2>
          <StatusChip value={event.notificationStatus} />
        </div>
        {isCandidateSignalEvent(event.eventType) ? (
          <p className="warning-text">
            Candidate evidence, not confirmed availability.
          </p>
        ) : null}
        <dl>
          <DetailField label="Event type">{event.eventType}</DetailField>
          <DetailField label="Product">
            <EventProductLink event={event} />
          </DetailField>
          <DetailField label="Attempts">{event.attemptCount}</DetailField>
          <DetailField label="Last attempt">
            {formatTimestamp(event.lastAttemptAt)}
          </DetailField>
          <DetailField label="Created">
            {formatTimestamp(event.createdAt)}
          </DetailField>
          <DetailField label="Notified">
            {formatTimestamp(event.notifiedAt)}
          </DetailField>
        </dl>
      </article>
      <article className="detail-panel evidence-panel">
        <h2>Payload JSON</h2>
        <pre>{JSON.stringify(event.payload, null, 2)}</pre>
      </article>
      <article className="detail-panel evidence-panel">
        <h2>Notification error</h2>
        {event.notificationError ? (
          <pre>{event.notificationError}</pre>
        ) : (
          <p className="muted-text">
            No notification error persisted for this Event.
          </p>
        )}
      </article>
    </section>
  );
}

function RunsPage({
  fetchRuns,
  refreshIntervalMs,
}: {
  fetchRuns: RunsFetcher;
  refreshIntervalMs: number;
}) {
  const [tableState, setTableState] = useState(() =>
    parseRunsTableState(window.location.search),
  );
  const [runs, setRuns] = useState<DashboardRunList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      setRuns(await fetchRuns(tableState));
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchRuns, tableState]);

  useDashboardRefresh(refresh, refreshIntervalMs);

  const updateTableState = (next: Partial<RunsTableState>) => {
    const updated = { ...tableState, ...next };
    setTableState(updated);
    navigateTo(`/runs?${serializeRunsTableState(updated)}`);
  };

  return (
    <>
      <header className="dashboard-header">
        <div>
          <p className="ledger-label">Watcher dashboard</p>
          <h1>Runs</h1>
        </div>
        <button type="button" onClick={() => void refresh()}>
          {isRefreshing ? "Refreshing..." : "Refresh Runs"}
        </button>
      </header>

      <section className="product-toolbar" aria-label="Run filters">
        <label>
          Status
          <select
            aria-label="Run status"
            onChange={(event) =>
              updateTableState({
                status: parseRunStatus(event.currentTarget.value),
                page: 1,
              })
            }
            value={tableState.status ?? "all"}
          >
            <option value="all">All statuses</option>
            {RUN_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rows
          <select
            aria-label="Rows per page"
            onChange={(event) =>
              updateTableState({
                pageSize: Number(event.currentTarget.value),
                page: 1,
              })
            }
            value={tableState.pageSize}
          >
            {RUN_PAGE_SIZE_OPTIONS.map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select
            value={`${tableState.sortBy}.${tableState.sortDirection}`}
            onChange={(event) => {
              const [sortBy, sortDirection] =
                event.currentTarget.value.split(".");
              updateTableState({
                sortBy: parseRunSort(sortBy),
                sortDirection: sortDirection === "asc" ? "asc" : "desc",
                page: 1,
              });
            }}
          >
            <option value="startedAt.desc">Started, newest</option>
            <option value="startedAt.asc">Started, oldest</option>
            <option value="finishedAt.desc">Finished, newest</option>
            <option value="status.asc">Status</option>
            <option value="productCount.desc">Product count</option>
          </select>
        </label>
      </section>

      {error ? <p className="error-panel">{error}</p> : null}

      {runs ? (
        <>
          <RunsTable runs={runs.runs} />
          <footer className="table-footer">
            <span>
              Page {runs.pagination.page} of {runs.pagination.totalPages},{" "}
              {runs.pagination.totalItems} Runs
            </span>
            <span className="pagination-controls">
              <button
                className="ghost-button"
                disabled={tableState.page <= 1}
                type="button"
                onClick={() =>
                  updateTableState({ page: Math.max(1, tableState.page - 1) })
                }
              >
                Previous page
              </button>
              <button
                className="ghost-button"
                disabled={tableState.page >= runs.pagination.totalPages}
                type="button"
                onClick={() =>
                  updateTableState({
                    page: Math.min(
                      runs.pagination.totalPages,
                      tableState.page + 1,
                    ),
                  })
                }
              >
                Next page
              </button>
            </span>
          </footer>
        </>
      ) : (
        <section className="skeleton-table" aria-label="Loading Runs" />
      )}
    </>
  );
}

function RunsTable({ runs }: { runs: DashboardRunRow[] }) {
  const columns = useMemo<ColumnDef<DashboardRunRow>[]>(
    () => [
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <span>
            <StatusChip value={row.original.status} />
            {row.original.staleRunning ? (
              <span className="stale-note">
                Stale-looking, {row.original.staleRunning.minutesSinceStart}m
              </span>
            ) : null}
          </span>
        ),
      },
      {
        accessorKey: "startedAt",
        header: "Started",
        cell: ({ row }) => formatTimestamp(row.original.startedAt),
      },
      {
        accessorKey: "finishedAt",
        header: "Finished",
        cell: ({ row }) => formatTimestamp(row.original.finishedAt),
      },
      {
        id: "duration",
        header: "Duration",
        cell: ({ row }) => formatDuration(row.original.durationMs),
      },
      {
        accessorKey: "productCount",
        header: "Products",
      },
      {
        id: "error",
        header: "Error",
        cell: ({ row }) => (row.original.hasError ? "Present" : "None"),
      },
      {
        id: "detail",
        header: "",
        cell: ({ row }) => <a href={`/runs/${row.original.id}`}>View Run</a>,
      },
    ],
    [],
  );
  const table = useReactTable({
    data: runs,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return <VirtualizedTable rowHeight={56} table={table} />;
}

function RunDetailPage({
  fetchRunDetail,
  refreshIntervalMs,
  runId,
}: {
  fetchRunDetail: RunDetailFetcher;
  refreshIntervalMs: number;
  runId: number;
}) {
  const [run, setRun] = useState<DashboardRunRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const run = await fetchRunDetail(runId);
      setRun(run);
      setError(run ? null : "Run not found");
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchRunDetail, runId]);

  useDashboardRefresh(refresh, refreshIntervalMs);

  if (error) {
    return <p className="error-panel">{error}</p>;
  }

  if (!run) {
    return <section className="skeleton-panel" aria-label="Loading Run" />;
  }

  return (
    <section className="detail-layout" aria-label={`Run ${run.id} detail`}>
      <div className="detail-actions">
        <a className="back-link" href="/runs">
          Back to Runs
        </a>
        <button type="button" onClick={() => void refresh()}>
          {isRefreshing ? "Refreshing..." : "Refresh Run"}
        </button>
      </div>
      <article className="detail-panel">
        <div className="detail-title">
          <h2>Run #{run.id}</h2>
          <StatusChip value={run.status} />
        </div>
        {run.staleRunning ? (
          <p className="warning-text">
            This Run looks stale from persisted timestamps:{" "}
            {run.staleRunning.minutesSinceStart} minutes since start.
          </p>
        ) : null}
        <dl>
          <DetailField label="Started">
            {formatTimestamp(run.startedAt)}
          </DetailField>
          <DetailField label="Finished">
            {formatTimestamp(run.finishedAt)}
          </DetailField>
          <DetailField label="Duration">
            {formatDuration(run.durationMs)}
          </DetailField>
          <DetailField label="Products seen">{run.productCount}</DetailField>
        </dl>
      </article>
      <article className="detail-panel">
        <h2>Error message</h2>
        {run.errorMessage ? (
          <pre>{run.errorMessage}</pre>
        ) : (
          <p className="muted-text">No error message persisted for this Run.</p>
        )}
      </article>
    </section>
  );
}

function SummaryPage({
  fetchSummary,
  refreshIntervalMs,
}: {
  fetchSummary: SummaryFetcher;
  refreshIntervalMs: number;
}) {
  const [summary, setSummary] = useState<WatcherDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      setSummary(await fetchSummary());
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchSummary]);

  useDashboardRefresh(refresh, refreshIntervalMs);

  return (
    <>
      <header className="dashboard-header">
        <div>
          <p className="ledger-label">Watcher dashboard</p>
          <h1>Supplywatch summary</h1>
        </div>
        <button type="button" onClick={() => void refresh()}>
          {isRefreshing ? "Refreshing..." : "Refresh summary"}
        </button>
      </header>

      {error ? <p className="error-panel">{error}</p> : null}

      {summary ? (
        <section className="summary-grid" aria-label="Watcher summary">
          <SummaryPanel title="Latest Run">
            <StatusChip value={summary.latestRun?.status ?? "none"} />
            <dl>
              <DetailField label="Started">
                {formatTimestamp(summary.latestRun?.startedAt)}
              </DetailField>
              <DetailField label="Finished">
                {formatTimestamp(summary.latestRun?.finishedAt)}
              </DetailField>
              <DetailField label="Products seen">
                {summary.latestRun?.productCount ?? 0}
              </DetailField>
            </dl>
          </SummaryPanel>

          <SummaryPanel title="Notifications">
            <dl>
              <DetailField label="Pending notifications">
                {summary.notifications.pending}
              </DetailField>
              <DetailField label="Failed notifications">
                {summary.notifications.failed}
              </DetailField>
            </dl>
          </SummaryPanel>

          <SummaryPanel title="Run Health">
            {summary.staleRunningRun ? (
              <p className="warning-text">
                Run #{summary.staleRunningRun.id} has been running for{" "}
                {summary.staleRunningRun.minutesSinceStart} minutes.
              </p>
            ) : (
              <p className="muted-text">No stale-looking running Run.</p>
            )}
            <dl>
              <DetailField label="Health Events">
                {summary.healthEvents.total}
              </DetailField>
            </dl>
          </SummaryPanel>

          <SummaryPanel title="Health Event Types">
            {summary.healthEvents.byType.length > 0 ? (
              <ul className="event-list">
                {summary.healthEvents.byType.map((event) => (
                  <li key={event.eventType}>
                    <span>{event.eventType}</span>
                    <strong>{event.count}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted-text">No persisted health Events.</p>
            )}
          </SummaryPanel>
        </section>
      ) : (
        <section className="summary-grid" aria-label="Loading summary">
          <div className="skeleton-panel" />
          <div className="skeleton-panel" />
          <div className="skeleton-panel" />
        </section>
      )}

      <footer>
        Last refreshed:{" "}
        {summary ? formatTimestamp(summary.generatedAt) : "not yet"}
      </footer>
    </>
  );
}

async function fetchSummaryFromApi(): Promise<WatcherDashboardSummary> {
  const response = await fetch("/api/summary");

  if (!response.ok) {
    throw new Error(`Summary request failed with HTTP ${response.status}`);
  }

  return (await response.json()) as WatcherDashboardSummary;
}

async function fetchProductsFromApi(
  options: DashboardProductListOptions,
): Promise<DashboardProductPage> {
  const response = await fetch(
    `/api/products?${productListSearchParams(options)}`,
  );

  if (!response.ok) {
    throw new Error(`Products request failed with HTTP ${response.status}`);
  }

  return (await response.json()) as DashboardProductPage;
}

async function fetchProductDetailFromApi(
  stableId: string,
): Promise<DashboardProductDetail | null> {
  const response = await fetch(`/api/products/${encodeURIComponent(stableId)}`);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Product request failed with HTTP ${response.status}`);
  }

  return (await response.json()) as DashboardProductDetail;
}

async function fetchEventsFromApi(
  state: EventsTableState,
): Promise<DashboardEventList> {
  const response = await fetch(
    `/api/events?${serializeEventsTableState(state)}`,
  );

  if (!response.ok) {
    throw new Error(`Events request failed with HTTP ${response.status}`);
  }

  return (await response.json()) as DashboardEventList;
}

async function fetchEventDetailFromApi(
  eventId: number,
): Promise<DashboardEventDetail | null> {
  const response = await fetch(`/api/events/${eventId}`);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Event request failed with HTTP ${response.status}`);
  }

  return (await response.json()) as DashboardEventDetail;
}

async function fetchRunsFromApi(
  state: RunsTableState,
): Promise<DashboardRunList> {
  const response = await fetch(`/api/runs?${serializeRunsTableState(state)}`);

  if (!response.ok) {
    throw new Error(`Runs request failed with HTTP ${response.status}`);
  }

  return (await response.json()) as DashboardRunList;
}

async function fetchRunDetailFromApi(
  runId: number,
): Promise<DashboardRunRow | null> {
  const response = await fetch(`/api/runs/${runId}`);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Run request failed with HTTP ${response.status}`);
  }

  return (await response.json()) as DashboardRunRow;
}

function parseProductListOptions(): DashboardProductListOptions {
  const searchParams = new URLSearchParams(window.location.search);

  return {
    search: optionalParam(searchParams.get("search")),
    availabilityStates: searchParams
      .getAll("availability")
      .flatMap((value) => selectedAvailabilityStates(value)),
    watchStatus: watchStatus(searchParams.get("watchStatus")) ?? "active",
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

function productListSearchParams(
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

function optionalParam(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function positiveInteger(value: string | null): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function watchStatus(
  value: string | null,
): DashboardProductWatchStatus | undefined {
  for (const status of DASHBOARD_PRODUCT_WATCH_STATUSES) {
    if (value === status) {
      return status;
    }
  }

  return undefined;
}

function selectedAvailabilityStates(value: string): BuyableState[] {
  return value.split(",").flatMap((state) => {
    const parsed = availabilityState(state);
    return parsed ? [parsed] : [];
  });
}

function availabilityState(value: string): BuyableState | undefined {
  return BUYABLE_STATES.find((state) => state === value);
}

function productSort(value: string | null): DashboardProductSort | undefined {
  const [field, direction] = value?.split(".") ?? [];

  if (!isProductSortField(field)) {
    return undefined;
  }

  return {
    field,
    direction: direction === "asc" ? "asc" : "desc",
  };
}

function productSortParam(sort: DashboardProductSort): string {
  return `${sort.field}.${sort.direction}`;
}

function isProductSortField(
  value: string | undefined,
): value is DashboardProductSortField {
  return DASHBOARD_PRODUCT_SORT_FIELDS.some((field) => field === value);
}

function parseRunsTableState(search: string): RunsTableState {
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

function parseEventsTableState(search: string): EventsTableState {
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

function parseRunStatus(value: string | null): RunStatus | undefined {
  if (isRunStatus(value)) {
    return value;
  }

  return undefined;
}

function parseNotificationStatus(
  value: string | null,
): NotificationStatus | undefined {
  if (isNotificationStatus(value)) {
    return value;
  }

  return undefined;
}

function serializeRunsTableState(state: RunsTableState): string {
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

function serializeEventsTableState(state: EventsTableState): string {
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

function parseRunSort(value: string | null | undefined): DashboardRunSortBy {
  if (isRunSort(value)) {
    return value;
  }

  return DEFAULT_RUNS_TABLE_STATE.sortBy;
}

function parseEventSort(
  value: string | null | undefined,
): DashboardEventSortBy {
  if (isEventSort(value)) {
    return value;
  }

  return DEFAULT_EVENTS_TABLE_STATE.sortBy;
}

function isRunStatus(value: string | null): value is RunStatus {
  return RUN_STATUSES.some((status) => status === value);
}

function isNotificationStatus(
  value: string | null,
): value is NotificationStatus {
  return NOTIFICATION_STATUSES.some((status) => status === value);
}

function isRunSort(
  value: string | null | undefined,
): value is DashboardRunSortBy {
  return RUN_SORT_COLUMNS.some((column) => column === value);
}

function isEventSort(
  value: string | null | undefined,
): value is DashboardEventSortBy {
  return EVENT_SORT_COLUMNS.some((column) => column === value);
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isCandidateSignalEvent(eventType: string): boolean {
  return eventType.includes("candidate") || eventType.includes("signal");
}

function EventProductLink({
  event,
}: {
  event: Pick<DashboardEventRow, "productId" | "productName">;
}) {
  if (!event.productId) {
    return <>none</>;
  }

  return (
    <a href={`/products/${encodeURIComponent(event.productId)}`}>
      {event.productName ?? event.productId}
    </a>
  );
}

function ProductIdentity({ product }: { product: DashboardProductRow }) {
  return (
    <div className="product-identity">
      <ProductImage product={product} compact />
      <a href={`/products/${encodeURIComponent(product.stableId)}`}>
        {product.name ?? product.stableId}
      </a>
    </div>
  );
}

function ProductImage({
  product,
  compact = false,
}: {
  product: Pick<DashboardProductRow, "imageUrl" | "name" | "stableId">;
  compact?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!product.imageUrl || failed) {
    return (
      <div
        className={
          compact ? "product-thumb fallback" : "product-image fallback"
        }
      >
        Image unavailable
      </div>
    );
  }

  return (
    <img
      alt={product.name ?? product.stableId}
      className={compact ? "product-thumb" : "product-image"}
      src={product.imageUrl}
      onError={() => setFailed(true)}
    />
  );
}

function DashboardTable({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <table className="product-table" style={style}>
      {children}
    </table>
  );
}

function SummaryPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="summary-panel">
      <h2>{title}</h2>
      {children}
    </article>
  );
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function StatusChip({ value }: { value: string }) {
  return <span className={`status-chip status-chip-${value}`}>{value}</span>;
}

function ChipList({ values }: { values: string[] }) {
  return (
    <span className="chip-list">
      {values.map((value) => (
        <span className="status-chip" key={value}>
          {value}
        </span>
      ))}
    </span>
  );
}

function availabilityLabel(value: BuyableState): string {
  switch (value) {
    case "employee_only":
      return "Employee only";
    case "out_of_stock":
      return "Out of stock";
    case "publicly_buyable":
      return "Publicly available";
    case "unknown":
      return "Unknown";
  }
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "none";
  }

  return `${value.slice(11, 19)} UTC`;
}

function formatDuration(durationMs: number | null): string {
  if (durationMs === null) {
    return "none";
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${Math.round(durationMs / 1000)}s`;
}

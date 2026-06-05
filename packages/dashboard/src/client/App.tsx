import type {
  BuyableState,
  DashboardProductDetail,
  DashboardProductListOptions,
  DashboardProductPage,
  DashboardProductRow,
  DashboardProductSort,
  DashboardProductSortField,
  DashboardProductWatchStatus,
  WatcherDashboardSummary,
} from "@supplywatch/state";
import {
  DASHBOARD_PRODUCT_SORT_FIELDS,
  DASHBOARD_PRODUCT_WATCH_STATUSES,
} from "@supplywatch/state/dashboard";
import { BUYABLE_STATES } from "@supplywatch/state/types";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import "./styles.css";

export type SummaryFetcher = () => Promise<WatcherDashboardSummary>;
export type ProductListFetcher = (
  options: DashboardProductListOptions,
) => Promise<DashboardProductPage>;
export type ProductDetailFetcher = (
  stableId: string,
) => Promise<DashboardProductDetail | null>;

export type AppProps = {
  fetchSummary?: SummaryFetcher;
  fetchProducts?: ProductListFetcher;
  fetchProductDetail?: ProductDetailFetcher;
  refreshIntervalMs?: number;
};

const DEFAULT_REFRESH_INTERVAL_MS = 15_000;
const DEFAULT_PRODUCT_PAGE_SIZE = 50;
const DEFAULT_PRODUCT_SORT: DashboardProductSort = {
  field: "lastSeenAt",
  direction: "desc",
};

export function App({
  fetchSummary = fetchSummaryFromApi,
  fetchProducts = fetchProductsFromApi,
  fetchProductDetail = fetchProductDetailFromApi,
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
        stableId={decodeURIComponent(pathname.replace("/products/", ""))}
      />
    );
  }

  return <ProductsPage fetchProducts={props.fetchProducts} />;
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
}: {
  fetchProducts: ProductListFetcher;
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

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
          <VirtualizedProductTable table={table} />
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

function VirtualizedProductTable({
  table,
}: {
  table: ReturnType<typeof useReactTable<DashboardProductRow>>;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
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
          transform: `translateY(${index * 72}px)`,
        }));

  return (
    <div className="table-viewport" ref={parentRef}>
      <Table style={{ minHeight: `${Math.max(rows.length, 1) * 72}px` }}>
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
      </Table>
    </div>
  );
}

function ProductDetailPage({
  fetchProductDetail,
  stableId,
}: {
  fetchProductDetail: ProductDetailFetcher;
  stableId: string;
}) {
  const [product, setProduct] = useState<DashboardProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSnapshotOpen, setIsSnapshotOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchProductDetail(stableId)
      .then((product) => {
        if (!cancelled) {
          setProduct(product);
          setError(product ? null : "Product not found");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : String(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchProductDetail, stableId]);

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

function Table({
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

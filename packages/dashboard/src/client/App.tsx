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
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <nav
        className="flex flex-wrap items-center gap-2 border-b pb-3"
        aria-label="Dashboard navigation"
      >
        <NavLink
          active={route.pathname.startsWith("/products")}
          href="/products"
        >
          Products
        </NavLink>
        <NavLink active={route.pathname.startsWith("/events")} href="/events">
          Events
        </NavLink>
        <NavLink active={route.pathname.startsWith("/runs")} href="/runs">
          Runs
        </NavLink>
        <NavLink active={route.pathname === "/summary"} href="/summary">
          Summary
        </NavLink>
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

function NavLink({
  active,
  children,
  href,
}: {
  active: boolean;
  children: ReactNode;
  href: string;
}) {
  return (
    <Button asChild size="sm" variant={active ? "secondary" : "ghost"}>
      <a href={href}>{children}</a>
    </Button>
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

type MountedCheck = () => boolean;
type DashboardRefresh = (isMounted: MountedCheck) => Promise<void>;

function useDashboardRefresh(
  refresh: DashboardRefresh,
  refreshIntervalMs: number,
): { isRefreshing: boolean; refreshNow: () => void } {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshNow = useCallback(() => {
    setIsRefreshing(true);

    void refresh(() => isMountedRef.current).finally(() => {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    });
  }, [refresh]);

  useEffect(() => {
    refreshNow();

    if (refreshIntervalMs <= 0) {
      return;
    }

    const interval = window.setInterval(refreshNow, refreshIntervalMs);

    return () => window.clearInterval(interval);
  }, [refreshIntervalMs, refreshNow]);

  return { isRefreshing, refreshNow };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function PageHeader({
  eyebrow = "Watcher dashboard",
  title,
  actionLabel,
  isRefreshing,
  onRefresh,
  backHref,
  backLabel,
  children,
}: {
  eyebrow?: string;
  title: string;
  actionLabel: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  backHref?: string;
  backLabel?: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        {backHref && backLabel ? (
          <Button asChild size="sm" variant="ghost">
            <a href={backHref}>{backLabel}</a>
          </Button>
        ) : null}
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            {eyebrow}
          </p>
          <h1 className="truncate text-2xl font-semibold tracking-normal">
            {title}
          </h1>
          {children}
        </div>
      </div>
      <Button type="button" onClick={onRefresh}>
        {isRefreshing ? "Refreshing..." : actionLabel}
      </Button>
    </header>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <Card aria-label={label}>
      <CardContent className="flex flex-col gap-3 pt-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-20 w-full" />
      </CardContent>
    </Card>
  );
}

function LoadingTable({ label }: { label: string }) {
  return (
    <Card aria-label={label}>
      <CardContent className="flex flex-col gap-2 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
      </CardContent>
    </Card>
  );
}

function Toolbar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section
      className="grid gap-4 border-b pb-4 sm:grid-cols-2 xl:grid-cols-6"
      aria-label={label}
    >
      {children}
    </section>
  );
}

function TextFilter({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field className="min-w-44">
      <FieldLabel>{label}</FieldLabel>
      <Input
        aria-label={label}
        name={name}
        value={value}
        onInput={(event) => onChange(event.currentTarget.value)}
      />
    </Field>
  );
}

function SelectFilter({
  label,
  value,
  options,
  onChange,
  ariaLabel,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  return (
    <Field className="min-w-44">
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={ariaLabel ?? label} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function CheckboxFilter({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Field orientation="horizontal">
      <Checkbox
        aria-label={label}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <FieldLabel>{label}</FieldLabel>
    </Field>
  );
}

function PaginationFooter({
  label,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
}: {
  label: string;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <footer className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <Button
          disabled={!canGoPrevious}
          size="sm"
          type="button"
          variant="outline"
          onClick={onPrevious}
        >
          Previous page
        </Button>
        <Button
          disabled={!canGoNext}
          size="sm"
          type="button"
          variant="outline"
          onClick={onNext}
        >
          Next page
        </Button>
      </div>
    </footer>
  );
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

  const { isRefreshing, refreshNow } = useDashboardRefresh(
    useCallback(
      async (isMounted) => {
        setError(null);

        try {
          const page = await fetchProducts(options);
          if (isMounted()) {
            setPage(page);
          }
        } catch (error) {
          if (isMounted()) {
            setError(errorMessage(error));
          }
        }
      },
      [fetchProducts, options],
    ),
    refreshIntervalMs,
  );

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
    <div className="flex flex-col gap-5">
      <PageHeader
        actionLabel="Refresh Products"
        isRefreshing={isRefreshing}
        title="Products"
        onRefresh={refreshNow}
      />

      <Toolbar label="Product filters">
        <TextFilter
          label="Search"
          name="product-search"
          value={options.search ?? ""}
          onChange={(value) =>
            updateOptions({
              ...options,
              search: value || undefined,
              page: 1,
            })
          }
        />
        <TextFilter
          label="Collection"
          name="product-collection"
          value={options.collection ?? ""}
          onChange={(value) =>
            updateOptions({
              ...options,
              collection: value || undefined,
              page: 1,
            })
          }
        />
        <SelectFilter
          label="Availability state"
          value={options.availabilityStates?.[0] ?? "all"}
          options={[
            { value: "all", label: "All" },
            ...BUYABLE_STATES.map((state) => ({
              value: state,
              label: availabilityLabel(state),
            })),
          ]}
          onChange={(value) =>
            updateOptions({
              ...options,
              availabilityStates:
                value === "all" ? [] : selectedAvailabilityStates(value),
              page: 1,
            })
          }
        />
        <SelectFilter
          label="Watch status"
          value={options.watchStatus ?? "active"}
          options={[
            { value: "active", label: "Active" },
            { value: "retired", label: "Retired" },
            { value: "all", label: "All" },
          ]}
          onChange={(value) =>
            updateOptions({
              ...options,
              watchStatus: watchStatus(value),
              page: 1,
            })
          }
        />
        <SelectFilter
          label="Sort"
          value={
            options.sort
              ? productSortParam(options.sort)
              : productSortParam(DEFAULT_PRODUCT_SORT)
          }
          options={[
            { value: "lastSeenAt.desc", label: "Last seen, newest" },
            { value: "lastSeenAt.asc", label: "Last seen, oldest" },
            { value: "firstSeenAt.desc", label: "First seen, newest" },
            { value: "name.asc", label: "Name, A to Z" },
            { value: "collection.asc", label: "Collection, A to Z" },
            { value: "availabilityState.asc", label: "Availability state" },
          ]}
          onChange={(value) =>
            updateOptions({
              ...options,
              sort: productSort(value),
              page: 1,
            })
          }
        />
        <CheckboxFilter
          checked={options.notificationRelevant ?? false}
          label="Notification relevant"
          onChange={(checked) =>
            updateOptions({
              ...options,
              notificationRelevant: checked || undefined,
              page: 1,
            })
          }
        />
      </Toolbar>

      {error ? <ErrorPanel message={error} /> : null}

      {page ? (
        <>
          <VirtualizedTable rowHeight={72} table={table} />
          <PaginationFooter
            canGoNext={page.page < page.totalPages}
            canGoPrevious={page.page > 1}
            label={`Page ${page.page} of ${page.totalPages}, ${page.total} Products`}
            onNext={() =>
              updateOptions({
                ...options,
                page: Math.min(page.totalPages, page.page + 1),
              })
            }
            onPrevious={() =>
              updateOptions({
                ...options,
                page: Math.max(1, page.page - 1),
              })
            }
          />
        </>
      ) : (
        <LoadingTable label="Loading Products" />
      )}
    </div>
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
  const tableWidth = Math.max(table.getTotalSize(), 1080);
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
    <Card>
      <CardContent className="pt-4">
        <div
          className="max-h-[620px] overflow-auto rounded-lg border"
          ref={parentRef}
        >
          <Table className="grid" style={{ width: `${tableWidth}px` }}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow className="flex" key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      className="flex items-center"
                      key={header.id}
                      style={{ width: `${header.getSize()}px` }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody
              className="relative grid"
              style={{
                height: `${Math.max(virtualizer.getTotalSize(), rowHeight)}px`,
              }}
            >
              {visibleRows.map(({ row, transform }) =>
                row ? (
                  <TableRow
                    className="absolute flex w-full"
                    key={row.id}
                    style={{ height: `${rowHeight}px`, transform }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        className="flex items-center overflow-hidden"
                        key={cell.id}
                        style={{ width: `${cell.column.getSize()}px` }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ) : null,
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
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
  const [isSnapshotOpen, setIsSnapshotOpen] = useState(false);

  const { isRefreshing, refreshNow } = useDashboardRefresh(
    useCallback(
      async (isMounted) => {
        try {
          const product = await fetchProductDetail(stableId);
          if (isMounted()) {
            setProduct(product);
            setError(product ? null : "Product not found");
          }
        } catch (error) {
          if (isMounted()) {
            setError(errorMessage(error));
          }
        }
      },
      [fetchProductDetail, stableId],
    ),
    refreshIntervalMs,
  );

  if (error) {
    return <ErrorPanel message={error} />;
  }

  if (!product) {
    return <LoadingPanel label="Loading Product" />;
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        actionLabel="Refresh Product"
        backHref="/products"
        backLabel="Back to Products"
        isRefreshing={isRefreshing}
        title={product.name ?? product.stableId}
        onRefresh={refreshNow}
      >
        <p className="text-sm text-muted-foreground">{product.stableId}</p>
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        {product.sourceUrl ? (
          <Button asChild size="sm" variant="outline">
            <a href={product.sourceUrl} target="_blank" rel="noreferrer">
              Open source
            </a>
          </Button>
        ) : null}
      </div>

      <section className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <ProductImage product={product} />
        <Card>
          <CardHeader>
            <CardTitle>Curated state</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Product overrides</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {product.override ? (
              <>
                <ChipList values={product.overrideBadges} />
                {product.override.annotation ? (
                  <p>{product.override.annotation}</p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No Product override is recorded.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Product Events</CardTitle>
          </CardHeader>
          <CardContent>
            {product.recentEvents.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {product.recentEvents.map((event) => (
                  <li
                    className="flex items-center justify-between gap-3"
                    key={event.id}
                  >
                    <span>{event.eventType}</span>
                    <strong>{event.notificationStatus}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No recent Product Events.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <Collapsible open={isSnapshotOpen} onOpenChange={setIsSnapshotOpen}>
          <CardHeader>
            <CardTitle>Snapshot and fingerprint</CardTitle>
            <CollapsibleTrigger asChild>
              <Button size="sm" type="button" variant="outline">
                Snapshot and fingerprint
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs">
                {JSON.stringify(
                  {
                    normalizedSnapshot: product.normalizedSnapshot,
                    rawFingerprint: product.rawFingerprint,
                  },
                  null,
                  2,
                )}
              </pre>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
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

  const { isRefreshing, refreshNow } = useDashboardRefresh(
    useCallback(
      async (isMounted) => {
        setError(null);

        try {
          const events = await fetchEvents(tableState);
          if (isMounted()) {
            setEvents(events);
          }
        } catch (error) {
          if (isMounted()) {
            setError(errorMessage(error));
          }
        }
      },
      [fetchEvents, tableState],
    ),
    refreshIntervalMs,
  );

  const updateTableState = (next: Partial<EventsTableState>) => {
    const updated = { ...tableState, ...next };
    setTableState(updated);
    navigateTo(`/events?${serializeEventsTableState(updated)}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        actionLabel="Refresh Events"
        isRefreshing={isRefreshing}
        title="Events"
        onRefresh={refreshNow}
      />

      <Toolbar label="Event filters">
        <TextFilter
          label="Event type"
          name="event-type"
          value={tableState.eventType ?? ""}
          onChange={(value) =>
            updateTableState({
              eventType: value || undefined,
              page: 1,
            })
          }
        />
        <TextFilter
          label="Product"
          name="event-product"
          value={tableState.productId ?? ""}
          onChange={(value) =>
            updateTableState({
              productId: value || undefined,
              page: 1,
            })
          }
        />
        <SelectFilter
          label="Notification status"
          value={tableState.notificationStatus ?? "all"}
          options={[
            { value: "all", label: "All statuses" },
            ...NOTIFICATION_STATUSES.map((status) => ({
              value: status,
              label: status,
            })),
          ]}
          onChange={(value) =>
            updateTableState({
              notificationStatus: parseNotificationStatus(value),
              page: 1,
            })
          }
        />
        <SelectFilter
          ariaLabel="Event rows per page"
          label="Rows"
          value={String(tableState.pageSize)}
          options={EVENT_PAGE_SIZE_OPTIONS.map((pageSize) => ({
            value: String(pageSize),
            label: String(pageSize),
          }))}
          onChange={(value) =>
            updateTableState({
              pageSize: Number(value),
              page: 1,
            })
          }
        />
        <SelectFilter
          label="Sort"
          value={`${tableState.sortBy}.${tableState.sortDirection}`}
          options={[
            { value: "createdAt.desc", label: "Created, newest" },
            { value: "createdAt.asc", label: "Created, oldest" },
            { value: "notifiedAt.desc", label: "Notified, newest" },
            { value: "eventType.asc", label: "Event type" },
            { value: "notificationStatus.asc", label: "Notification status" },
            { value: "attemptCount.desc", label: "Attempt count" },
          ]}
          onChange={(value) => {
            const [sortBy, sortDirection] = value.split(".");
            updateTableState({
              sortBy: parseEventSort(sortBy),
              sortDirection: sortDirection === "asc" ? "asc" : "desc",
              page: 1,
            });
          }}
        />
      </Toolbar>

      {error ? <ErrorPanel message={error} /> : null}

      {events ? (
        <>
          <EventsTable events={events.events} />
          <PaginationFooter
            canGoNext={tableState.page < events.pagination.totalPages}
            canGoPrevious={tableState.page > 1}
            label={`Page ${events.pagination.page} of ${events.pagination.totalPages}, ${events.pagination.totalItems} Events`}
            onNext={() =>
              updateTableState({
                page: Math.min(
                  events.pagination.totalPages,
                  tableState.page + 1,
                ),
              })
            }
            onPrevious={() =>
              updateTableState({ page: Math.max(1, tableState.page - 1) })
            }
          />
        </>
      ) : (
        <LoadingTable label="Loading Events" />
      )}
    </div>
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
              <Badge className="ml-2" variant="outline">
                Candidate evidence
              </Badge>
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

  const { isRefreshing, refreshNow } = useDashboardRefresh(
    useCallback(
      async (isMounted) => {
        try {
          const event = await fetchEventDetail(eventId);
          if (isMounted()) {
            setEvent(event);
            setError(event ? null : "Event not found");
          }
        } catch (error) {
          if (isMounted()) {
            setError(errorMessage(error));
          }
        }
      },
      [eventId, fetchEventDetail],
    ),
    refreshIntervalMs,
  );

  if (error) {
    return <ErrorPanel message={error} />;
  }

  if (!event) {
    return <LoadingPanel label="Loading Event" />;
  }

  return (
    <section
      className="flex flex-col gap-5"
      aria-label={`Event ${event.id} detail`}
    >
      <PageHeader
        actionLabel="Refresh Event"
        backHref="/events"
        backLabel="Back to Events"
        isRefreshing={isRefreshing}
        title={`Event #${event.id}`}
        onRefresh={refreshNow}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Event #{event.id}
            <StatusChip value={event.notificationStatus} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isCandidateSignalEvent(event.eventType) ? (
            <Alert className="mb-4">
              <AlertDescription>
                Candidate evidence, not confirmed availability.
              </AlertDescription>
            </Alert>
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
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Payload JSON</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs">
            {JSON.stringify(event.payload, null, 2)}
          </pre>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Notification error</CardTitle>
        </CardHeader>
        <CardContent>
          {event.notificationError ? (
            <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs">
              {event.notificationError}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              No notification error persisted for this Event.
            </p>
          )}
        </CardContent>
      </Card>
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

  const { isRefreshing, refreshNow } = useDashboardRefresh(
    useCallback(
      async (isMounted) => {
        setError(null);

        try {
          const runs = await fetchRuns(tableState);
          if (isMounted()) {
            setRuns(runs);
          }
        } catch (error) {
          if (isMounted()) {
            setError(errorMessage(error));
          }
        }
      },
      [fetchRuns, tableState],
    ),
    refreshIntervalMs,
  );

  const updateTableState = (next: Partial<RunsTableState>) => {
    const updated = { ...tableState, ...next };
    setTableState(updated);
    navigateTo(`/runs?${serializeRunsTableState(updated)}`);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        actionLabel="Refresh Runs"
        isRefreshing={isRefreshing}
        title="Runs"
        onRefresh={refreshNow}
      />

      <Toolbar label="Run filters">
        <SelectFilter
          ariaLabel="Run status"
          label="Status"
          value={tableState.status ?? "all"}
          options={[
            { value: "all", label: "All statuses" },
            ...RUN_STATUSES.map((status) => ({
              value: status,
              label: status,
            })),
          ]}
          onChange={(value) =>
            updateTableState({
              status: parseRunStatus(value),
              page: 1,
            })
          }
        />
        <SelectFilter
          ariaLabel="Rows per page"
          label="Rows"
          value={String(tableState.pageSize)}
          options={RUN_PAGE_SIZE_OPTIONS.map((pageSize) => ({
            value: String(pageSize),
            label: String(pageSize),
          }))}
          onChange={(value) =>
            updateTableState({
              pageSize: Number(value),
              page: 1,
            })
          }
        />
        <SelectFilter
          label="Sort"
          value={`${tableState.sortBy}.${tableState.sortDirection}`}
          options={[
            { value: "startedAt.desc", label: "Started, newest" },
            { value: "startedAt.asc", label: "Started, oldest" },
            { value: "finishedAt.desc", label: "Finished, newest" },
            { value: "status.asc", label: "Status" },
            { value: "productCount.desc", label: "Product count" },
          ]}
          onChange={(value) => {
            const [sortBy, sortDirection] = value.split(".");
            updateTableState({
              sortBy: parseRunSort(sortBy),
              sortDirection: sortDirection === "asc" ? "asc" : "desc",
              page: 1,
            });
          }}
        />
      </Toolbar>

      {error ? <ErrorPanel message={error} /> : null}

      {runs ? (
        <>
          <RunsTable runs={runs.runs} />
          <PaginationFooter
            canGoNext={tableState.page < runs.pagination.totalPages}
            canGoPrevious={tableState.page > 1}
            label={`Page ${runs.pagination.page} of ${runs.pagination.totalPages}, ${runs.pagination.totalItems} Runs`}
            onNext={() =>
              updateTableState({
                page: Math.min(runs.pagination.totalPages, tableState.page + 1),
              })
            }
            onPrevious={() =>
              updateTableState({ page: Math.max(1, tableState.page - 1) })
            }
          />
        </>
      ) : (
        <LoadingTable label="Loading Runs" />
      )}
    </div>
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
              <Badge className="ml-2" variant="outline">
                Stale-looking, {row.original.staleRunning.minutesSinceStart}m
              </Badge>
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

  const { isRefreshing, refreshNow } = useDashboardRefresh(
    useCallback(
      async (isMounted) => {
        try {
          const run = await fetchRunDetail(runId);
          if (isMounted()) {
            setRun(run);
            setError(run ? null : "Run not found");
          }
        } catch (error) {
          if (isMounted()) {
            setError(errorMessage(error));
          }
        }
      },
      [fetchRunDetail, runId],
    ),
    refreshIntervalMs,
  );

  if (error) {
    return <ErrorPanel message={error} />;
  }

  if (!run) {
    return <LoadingPanel label="Loading Run" />;
  }

  return (
    <section
      className="flex flex-col gap-5"
      aria-label={`Run ${run.id} detail`}
    >
      <PageHeader
        actionLabel="Refresh Run"
        backHref="/runs"
        backLabel="Back to Runs"
        isRefreshing={isRefreshing}
        title={`Run #${run.id}`}
        onRefresh={refreshNow}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Run #{run.id}
            <StatusChip value={run.status} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {run.staleRunning ? (
            <Alert className="mb-4">
              <AlertDescription>
                This Run looks stale from persisted timestamps:{" "}
                {run.staleRunning.minutesSinceStart} minutes since start.
              </AlertDescription>
            </Alert>
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
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Error message</CardTitle>
        </CardHeader>
        <CardContent>
          {run.errorMessage ? (
            <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs">
              {run.errorMessage}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              No error message persisted for this Run.
            </p>
          )}
        </CardContent>
      </Card>
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

  const { isRefreshing, refreshNow } = useDashboardRefresh(
    useCallback(
      async (isMounted) => {
        setError(null);

        try {
          const summary = await fetchSummary();
          if (isMounted()) {
            setSummary(summary);
          }
        } catch (error) {
          if (isMounted()) {
            setError(errorMessage(error));
          }
        }
      },
      [fetchSummary],
    ),
    refreshIntervalMs,
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        actionLabel="Refresh summary"
        isRefreshing={isRefreshing}
        title="Supplywatch summary"
        onRefresh={refreshNow}
      />

      {error ? <ErrorPanel message={error} /> : null}

      {summary ? (
        <section
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          aria-label="Watcher summary"
        >
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
              <Alert>
                <AlertDescription>
                  Run #{summary.staleRunningRun.id} has been running for{" "}
                  {summary.staleRunningRun.minutesSinceStart} minutes.
                </AlertDescription>
              </Alert>
            ) : (
              <p className="text-sm text-muted-foreground">
                No stale-looking running Run.
              </p>
            )}
            <dl>
              <DetailField label="Health Events">
                {summary.healthEvents.total}
              </DetailField>
            </dl>
          </SummaryPanel>

          <SummaryPanel title="Health Event Types">
            {summary.healthEvents.byType.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {summary.healthEvents.byType.map((event) => (
                  <li
                    className="flex items-center justify-between gap-3"
                    key={event.eventType}
                  >
                    <span>{event.eventType}</span>
                    <strong>{event.count}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No persisted health Events.
              </p>
            )}
          </SummaryPanel>
        </section>
      ) : (
        <section
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          aria-label="Loading summary"
        >
          <LoadingPanel label="Loading latest Run" />
          <LoadingPanel label="Loading notifications" />
          <LoadingPanel label="Loading health" />
        </section>
      )}

      <footer className="text-sm text-muted-foreground">
        Last refreshed:{" "}
        {summary ? formatTimestamp(summary.generatedAt) : "not yet"}
      </footer>
    </div>
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
    <div className="flex min-w-0 items-center gap-3">
      <ProductImage product={product} compact />
      <a
        className="truncate font-medium underline-offset-4 hover:underline"
        href={`/products/${encodeURIComponent(product.stableId)}`}
      >
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

  if (compact) {
    return (
      <Avatar>
        {product.imageUrl && !failed ? (
          <AvatarImage
            alt={product.name ?? product.stableId}
            src={product.imageUrl}
            onError={() => setFailed(true)}
          />
        ) : null}
        <AvatarFallback>NA</AvatarFallback>
      </Avatar>
    );
  }

  if (!product.imageUrl || failed) {
    return (
      <Card className="aspect-square min-h-56 items-center justify-center">
        <CardContent className="text-sm text-muted-foreground">
          Image unavailable
        </CardContent>
      </Card>
    );
  }

  return (
    <img
      alt={product.name ?? product.stableId}
      className="aspect-square min-h-56 w-full rounded-xl object-cover ring-1 ring-foreground/10"
      src={product.imageUrl}
      onError={() => setFailed(true)}
    />
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
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
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
    <div className="grid gap-1 py-2 sm:grid-cols-[180px_1fr]">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm font-medium">{children}</dd>
    </div>
  );
}

function StatusChip({ value }: { value: string }) {
  return <Badge variant={statusVariant(value)}>{value}</Badge>;
}

function ChipList({ values }: { values: string[] }) {
  return (
    <span className="flex flex-wrap gap-2">
      {values.map((value) => (
        <Badge variant="outline" key={value}>
          {value}
        </Badge>
      ))}
    </span>
  );
}

function statusVariant(
  value: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (value === "failed") {
    return "destructive";
  }
  if (value === "publicly_buyable" || value === "Publicly available") {
    return "default";
  }
  if (value === "unknown" || value === "none") {
    return "outline";
  }
  return "secondary";
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

import type {
  DashboardProductListOptions,
  DashboardProductPage,
} from "@supplywatch/state";
import { BUYABLE_STATES } from "@supplywatch/state/types";
import {
  getCoreRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import { fetchProductsFromApi } from "@/client/api/fetchers";
import { DEFAULT_PRODUCT_SORT } from "@/client/constants";
import { useDashboardRefresh } from "@/client/hooks/use-dashboard-refresh";
import {
  isProductSortField,
  parseProductListOptions,
  parseWatchStatus,
  productListSearchParams,
  selectedAvailabilityStates,
} from "@/client/lib/parsers/products";
import { navigateTo } from "@/client/router/navigate";
import type { ProductListFetcher } from "@/client/types";
import { DataTable } from "@/components/data-table/data-table";
import {
  CheckboxFilter,
  SelectFilter,
  TextFilter,
} from "@/components/filters/table-filters";
import {
  ErrorPanel,
  LoadingTable,
  PaginationFooter,
  TableShell,
  Toolbar,
} from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import {
  PRODUCT_GROW_COLUMNS,
  productColumns,
} from "@/components/products/product-columns";
import { availabilityLabel } from "@/lib/availability";
import { errorMessage } from "@/lib/error-message";

type ProductsPageProps = {
  fetchProducts?: ProductListFetcher;
  refreshIntervalMs: number;
};

export function ProductsPage({
  fetchProducts = fetchProductsFromApi,
  refreshIntervalMs,
}: ProductsPageProps) {
  const [options, setOptions] = useState(parseProductListOptions);
  const [page, setPage] = useState<DashboardProductPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { isRefreshing, refreshNow } = useDashboardRefresh(
    useCallback(
      async (isMounted) => {
        setError(null);

        try {
          const nextPage = await fetchProducts(options);
          if (isMounted()) {
            setPage(nextPage);
          }
        } catch (caught) {
          if (isMounted()) {
            setError(errorMessage(caught));
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

  const sorting = useMemo<SortingState>(() => {
    const sort = options.sort ?? DEFAULT_PRODUCT_SORT;
    return [{ id: sort.field, desc: sort.direction === "desc" }];
  }, [options.sort]);

  const table = useReactTable({
    data: page?.products ?? [],
    columns: productColumns,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      if (next.length === 0) {
        return;
      }

      const column = next[0];
      if (!column || !isProductSortField(column.id)) {
        return;
      }

      updateOptions({
        ...options,
        sort: {
          field: column.id,
          direction: column.desc ? "desc" : "asc",
        },
        page: 1,
      });
    },
    manualSorting: true,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
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
              watchStatus: parseWatchStatus(value) ?? "active",
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
        <TableShell
          summary={
            <>
              <span>
                Showing <strong>{page.products.length}</strong> of{" "}
                <strong>{page.total}</strong> Products
              </span>
              <span>
                Page <strong>{page.page}</strong> of{" "}
                <strong>{page.totalPages}</strong>
              </span>
            </>
          }
          footer={
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
          }
        >
          <DataTable growColumnIds={PRODUCT_GROW_COLUMNS} table={table} />
        </TableShell>
      ) : (
        <LoadingTable label="Loading Products" />
      )}
    </div>
  );
}

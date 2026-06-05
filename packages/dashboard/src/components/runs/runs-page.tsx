import type { DashboardRunList } from "@supplywatch/state";
import {
  getCoreRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import { fetchRunsFromApi } from "@/client/api/fetchers";
import { RUN_PAGE_SIZE_OPTIONS, RUN_STATUSES } from "@/client/constants";
import { useDashboardRefresh } from "@/client/hooks/use-dashboard-refresh";
import {
  isRunSort,
  parseRunStatus,
  parseRunsTableState,
  serializeRunsTableState,
} from "@/client/lib/parsers/runs";
import { navigateTo } from "@/client/router/navigate";
import type { RunsFetcher, RunsTableState } from "@/client/types";
import { DataTable } from "@/components/data-table/data-table";
import { SelectFilter } from "@/components/filters/table-filters";
import {
  ErrorPanel,
  LoadingTable,
  PaginationFooter,
  TableShell,
  Toolbar,
} from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import { runColumns } from "@/components/runs/run-columns";
import { errorMessage } from "@/lib/error-message";

type RunsPageProps = {
  fetchRuns?: RunsFetcher;
  refreshIntervalMs: number;
};

export function RunsPage({
  fetchRuns = fetchRunsFromApi,
  refreshIntervalMs,
}: RunsPageProps) {
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
          const nextRuns = await fetchRuns(tableState);
          if (isMounted()) {
            setRuns(nextRuns);
          }
        } catch (caught) {
          if (isMounted()) {
            setError(errorMessage(caught));
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

  const sorting = useMemo<SortingState>(
    () => [
      {
        id: tableState.sortBy,
        desc: tableState.sortDirection === "desc",
      },
    ],
    [tableState.sortBy, tableState.sortDirection],
  );

  const table = useReactTable({
    data: runs?.runs ?? [],
    columns: runColumns,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      if (next.length === 0) {
        return;
      }

      const column = next[0];
      if (!column || !isRunSort(column.id)) {
        return;
      }

      updateTableState({
        sortBy: column.id,
        sortDirection: column.desc ? "desc" : "asc",
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
      </Toolbar>

      {error ? <ErrorPanel message={error} /> : null}

      {runs ? (
        <TableShell
          summary={
            <>
              <span>
                Showing <strong>{runs.runs.length}</strong> of{" "}
                <strong>{runs.pagination.totalItems}</strong> Runs
              </span>
              <span>
                Page <strong>{runs.pagination.page}</strong> of{" "}
                <strong>{runs.pagination.totalPages}</strong>
              </span>
            </>
          }
          footer={
            <PaginationFooter
              canGoNext={tableState.page < runs.pagination.totalPages}
              canGoPrevious={tableState.page > 1}
              label={`Page ${runs.pagination.page} of ${runs.pagination.totalPages}, ${runs.pagination.totalItems} Runs`}
              onNext={() =>
                updateTableState({
                  page: Math.min(
                    runs.pagination.totalPages,
                    tableState.page + 1,
                  ),
                })
              }
              onPrevious={() =>
                updateTableState({
                  page: Math.max(1, tableState.page - 1),
                })
              }
            />
          }
        >
          <DataTable table={table} />
        </TableShell>
      ) : (
        <LoadingTable label="Loading Runs" />
      )}
    </div>
  );
}

import type {
  DashboardRunList,
  DashboardRunRow,
  DashboardRunSortBy,
  DashboardSortDirection,
  RunStatus,
  WatcherDashboardSummary,
} from "@supplywatch/state";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";

export type SummaryFetcher = () => Promise<WatcherDashboardSummary>;
export type RunsFetcher = (state: RunsTableState) => Promise<DashboardRunList>;
export type RunDetailFetcher = (runId: number) => Promise<DashboardRunRow>;

export type AppProps = {
  fetchSummary?: SummaryFetcher;
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

const DEFAULT_REFRESH_INTERVAL_MS = 15_000;
const RUN_STATUSES = ["running", "completed", "failed"] as const;
const DEFAULT_RUNS_TABLE_STATE: RunsTableState = {
  sortBy: "startedAt",
  sortDirection: "desc",
  page: 1,
  pageSize: 25,
};

export function App({
  fetchSummary = fetchSummaryFromApi,
  fetchRuns = fetchRunsFromApi,
  fetchRunDetail = fetchRunDetailFromApi,
  refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS,
}: AppProps) {
  const [locationKey, setLocationKey] = useState(() => window.location.href);

  useEffect(() => {
    const handlePopState = () => setLocationKey(window.location.href);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const path = new URL(locationKey).pathname;
  const runDetailMatch = /^\/runs\/(\d+)$/.exec(path);

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="ledger-label">Watcher dashboard</p>
          <h1>
            {runDetailMatch
              ? "Run detail"
              : path === "/runs"
                ? "Runs"
                : "Supplywatch summary"}
          </h1>
        </div>
        <nav className="dashboard-nav" aria-label="Dashboard sections">
          <a className={path === "/" ? "active" : ""} href="/">
            Summary
          </a>
          <a className={path.startsWith("/runs") ? "active" : ""} href="/runs">
            Runs
          </a>
        </nav>
      </header>

      {runDetailMatch ? (
        <RunDetailScreen
          fetchRunDetail={fetchRunDetail}
          runId={Number(runDetailMatch[1])}
        />
      ) : path === "/runs" ? (
        <RunsScreen
          fetchRuns={fetchRuns}
          onNavigate={(url) => {
            window.history.pushState(null, "", url);
            setLocationKey(window.location.href);
          }}
        />
      ) : (
        <SummaryScreen
          fetchSummary={fetchSummary}
          refreshIntervalMs={refreshIntervalMs}
        />
      )}
    </main>
  );
}

function SummaryScreen({
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
      <div className="toolbar">
        <button type="button" onClick={() => void refresh()}>
          {isRefreshing ? "Refreshing..." : "Refresh summary"}
        </button>
      </div>

      {error ? <p className="error-panel">{error}</p> : null}

      {summary ? (
        <section className="summary-grid" aria-label="Watcher summary">
          <SummaryPanel title="Latest Run">
            <StatusChip value={summary.latestRun?.status ?? "none"} />
            <dl>
              <div>
                <dt>Started</dt>
                <dd>{formatTimestamp(summary.latestRun?.startedAt)}</dd>
              </div>
              <div>
                <dt>Finished</dt>
                <dd>{formatTimestamp(summary.latestRun?.finishedAt)}</dd>
              </div>
              <div>
                <dt>Products seen</dt>
                <dd>{summary.latestRun?.productCount ?? 0}</dd>
              </div>
            </dl>
          </SummaryPanel>

          <SummaryPanel title="Notifications">
            <dl>
              <div>
                <dt>Pending notifications</dt>
                <dd>{summary.notifications.pending}</dd>
              </div>
              <div>
                <dt>Failed notifications</dt>
                <dd>{summary.notifications.failed}</dd>
              </div>
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
              <div>
                <dt>Health Events</dt>
                <dd>{summary.healthEvents.total}</dd>
              </div>
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

function RunsScreen({
  fetchRuns,
  onNavigate,
}: {
  fetchRuns: RunsFetcher;
  onNavigate: (url: string) => void;
}) {
  const search = window.location.search;
  const tableState = useMemo(() => parseRunsTableState(search), [search]);
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

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateTableState = (next: Partial<RunsTableState>) => {
    const updated = { ...tableState, ...next };
    onNavigate(`/runs?${serializeRunsTableState(updated)}`);
  };

  return (
    <>
      <div className="toolbar table-toolbar">
        <label>
          Status
          <select
            aria-label="Run status"
            onChange={(event) =>
              updateTableState({
                status:
                  event.currentTarget.value === "all"
                    ? undefined
                    : (event.currentTarget.value as RunStatus),
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
            {[10, 25, 50].map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void refresh()}>
          {isRefreshing ? "Refreshing..." : "Refresh Runs"}
        </button>
      </div>

      {error ? <p className="error-panel">{error}</p> : null}

      {runs ? (
        <>
          <RunsTable
            runs={runs.runs}
            sortBy={tableState.sortBy}
            sortDirection={tableState.sortDirection}
            onSort={(sortBy) =>
              updateTableState({
                sortBy,
                sortDirection:
                  tableState.sortBy === sortBy &&
                  tableState.sortDirection === "asc"
                    ? "desc"
                    : "asc",
                page: 1,
              })
            }
          />
          <div className="pagination-bar">
            <span>
              Page {runs.pagination.page} of {runs.pagination.totalPages},{" "}
              {runs.pagination.totalItems} Runs
            </span>
            <div>
              <button
                disabled={tableState.page <= 1}
                type="button"
                onClick={() => updateTableState({ page: tableState.page - 1 })}
              >
                Previous page
              </button>
              <button
                disabled={tableState.page >= runs.pagination.totalPages}
                type="button"
                onClick={() => updateTableState({ page: tableState.page + 1 })}
              >
                Next page
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="skeleton-panel" />
      )}
    </>
  );
}

function RunsTable({
  runs,
  sortBy,
  sortDirection,
  onSort,
}: {
  runs: DashboardRunRow[];
  sortBy: DashboardRunSortBy;
  sortDirection: DashboardSortDirection;
  onSort: (sortBy: DashboardRunSortBy) => void;
}) {
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 52,
    initialRect: { height: 520, width: 960 },
    overscan: 8,
  });
  const measuredVirtualRows = virtualizer.getVirtualItems();
  const virtualRows =
    measuredVirtualRows.length > 0
      ? measuredVirtualRows
      : rows.map((_, index) => ({
          index,
          start: index * 52,
          end: (index + 1) * 52,
        }));
  const paddingTop = virtualRows[0]?.start ?? 0;
  const paddingBottom = Math.max(
    0,
    virtualizer.getTotalSize() -
      (virtualRows[virtualRows.length - 1]?.end ?? 0),
  );

  return (
    <div className="table-frame">
      <div className="table-scroll" ref={scrollRef}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {sortableColumn(header.column.id) ? (
                      <button
                        className="sort-button"
                        type="button"
                        onClick={() =>
                          onSort(header.column.id as DashboardRunSortBy)
                        }
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {sortBy === header.column.id
                          ? sortDirection === "asc"
                            ? " ↑"
                            : " ↓"
                          : ""}
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )}
                  </TableHead>
                ))}
              </tr>
            ))}
          </TableHeader>
          <TableBody>
            {paddingTop > 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ height: paddingTop }} />
              </tr>
            ) : null}
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
            {paddingBottom > 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ height: paddingBottom }}
                />
              </tr>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function RunDetailScreen({
  fetchRunDetail,
  runId,
}: {
  fetchRunDetail: RunDetailFetcher;
  runId: number;
}) {
  const [run, setRun] = useState<DashboardRunRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRun(null);
    setError(null);
    void fetchRunDetail(runId)
      .then(setRun)
      .catch((error) =>
        setError(error instanceof Error ? error.message : String(error)),
      );
  }, [fetchRunDetail, runId]);

  if (error) {
    return <p className="error-panel">{error}</p>;
  }

  if (!run) {
    return <div className="skeleton-panel" />;
  }

  return (
    <section className="detail-layout" aria-label={`Run ${run.id} detail`}>
      <a href="/runs">Back to Runs</a>
      <div className="detail-panel">
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
          <div>
            <dt>Started</dt>
            <dd>{formatTimestamp(run.startedAt)}</dd>
          </div>
          <div>
            <dt>Finished</dt>
            <dd>{formatTimestamp(run.finishedAt)}</dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>{formatDuration(run.durationMs)}</dd>
          </div>
          <div>
            <dt>Products seen</dt>
            <dd>{run.productCount}</dd>
          </div>
        </dl>
      </div>
      <div className="detail-panel">
        <h2>Error message</h2>
        {run.errorMessage ? (
          <pre>{run.errorMessage}</pre>
        ) : (
          <p className="muted-text">No error message persisted for this Run.</p>
        )}
      </div>
    </section>
  );
}

async function fetchSummaryFromApi(): Promise<WatcherDashboardSummary> {
  const response = await fetch("/api/summary");

  if (!response.ok) {
    throw new Error(`Summary request failed with HTTP ${response.status}`);
  }

  return (await response.json()) as WatcherDashboardSummary;
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

async function fetchRunDetailFromApi(runId: number): Promise<DashboardRunRow> {
  const response = await fetch(`/api/runs/${runId}`);

  if (!response.ok) {
    throw new Error(`Run request failed with HTTP ${response.status}`);
  }

  return (await response.json()) as DashboardRunRow;
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

function Table({ children }: { children: ReactNode }) {
  return <table>{children}</table>;
}

function TableHeader({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>;
}

function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

function TableHead({ children }: { children: ReactNode }) {
  return <th>{children}</th>;
}

function TableRow({ children }: { children: ReactNode }) {
  return <tr>{children}</tr>;
}

function TableCell({ children }: { children: ReactNode }) {
  return <td>{children}</td>;
}

function StatusChip({ value }: { value: string }) {
  return <span className={`status-chip status-chip-${value}`}>{value}</span>;
}

function parseRunsTableState(search: string): RunsTableState {
  const params = new URLSearchParams(search);
  const status = params.get("status");

  return {
    status: RUN_STATUSES.includes(status as RunStatus)
      ? (status as RunStatus)
      : undefined,
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

function parseRunSort(value: string | null): DashboardRunSortBy {
  switch (value) {
    case "finishedAt":
    case "status":
    case "productCount":
    case "startedAt":
      return value;
    default:
      return DEFAULT_RUNS_TABLE_STATE.sortBy;
  }
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sortableColumn(columnId: string): boolean {
  return ["status", "startedAt", "finishedAt", "productCount"].includes(
    columnId,
  );
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

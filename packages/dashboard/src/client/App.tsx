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
const RUN_SORT_COLUMNS = [
  "status",
  "startedAt",
  "finishedAt",
  "productCount",
] as const satisfies readonly DashboardRunSortBy[];
const RUN_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const DEFAULT_RUNS_TABLE_STATE: RunsTableState = {
  sortBy: "startedAt",
  sortDirection: "desc",
  page: 1,
  pageSize: 25,
};

type DashboardRoute =
  | { kind: "summary" }
  | { kind: "runs" }
  | { kind: "runDetail"; runId: number };

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
  const route = parseDashboardRoute(path);
  const navigate = (url: string) => {
    window.history.pushState(null, "", url);
    setLocationKey(window.location.href);
  };

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="ledger-label">Watcher dashboard</p>
          <h1>{dashboardTitle(route)}</h1>
        </div>
        <nav className="dashboard-nav" aria-label="Dashboard sections">
          <a className={route.kind === "summary" ? "active" : ""} href="/">
            Summary
          </a>
          <a className={route.kind !== "summary" ? "active" : ""} href="/runs">
            Runs
          </a>
        </nav>
      </header>

      {route.kind === "runDetail" ? (
        <RunDetailScreen fetchRunDetail={fetchRunDetail} runId={route.runId} />
      ) : route.kind === "runs" ? (
        <RunsScreen fetchRuns={fetchRuns} onNavigate={navigate} />
      ) : (
        <SummaryScreen
          fetchSummary={fetchSummary}
          refreshIntervalMs={refreshIntervalMs}
        />
      )}
    </main>
  );
}

function parseDashboardRoute(path: string): DashboardRoute {
  const runDetailMatch = /^\/runs\/(\d+)$/.exec(path);

  if (runDetailMatch) {
    return {
      kind: "runDetail",
      runId: Number(runDetailMatch[1]),
    };
  }

  if (path === "/runs") {
    return { kind: "runs" };
  }

  return { kind: "summary" };
}

function dashboardTitle(route: DashboardRoute): string {
  switch (route.kind) {
    case "runDetail":
      return "Run detail";
    case "runs":
      return "Runs";
    case "summary":
      return "Supplywatch summary";
  }
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
                sortDirection: nextSortDirection(tableState, sortBy),
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

function nextSortDirection(
  tableState: RunsTableState,
  sortBy: DashboardRunSortBy,
): DashboardSortDirection {
  if (tableState.sortBy !== sortBy) {
    return "asc";
  }

  return tableState.sortDirection === "asc" ? "desc" : "asc";
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
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sortColumn = parseRunSortColumn(header.column.id);

                  return (
                    <th key={header.id}>
                      {sortColumn ? (
                        <button
                          className="sort-button"
                          type="button"
                          onClick={() => onSort(sortColumn)}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {sortBy === sortColumn
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
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {paddingTop > 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ height: paddingTop }} />
              </tr>
            ) : null}
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
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
          </tbody>
        </table>
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

function StatusChip({ value }: { value: string }) {
  return <span className={`status-chip status-chip-${value}`}>{value}</span>;
}

function parseRunsTableState(search: string): RunsTableState {
  const params = new URLSearchParams(search);
  const status = params.get("status");

  return {
    status: parseRunStatus(status),
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

function parseRunStatus(value: string | null): RunStatus | undefined {
  if (isRunStatus(value)) {
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

function parseRunSort(value: string | null): DashboardRunSortBy {
  return parseRunSortColumn(value) ?? DEFAULT_RUNS_TABLE_STATE.sortBy;
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isRunStatus(value: string | null): value is RunStatus {
  return RUN_STATUSES.some((status) => status === value);
}

function isRunSortColumn(value: string | null): value is DashboardRunSortBy {
  return RUN_SORT_COLUMNS.some((column) => column === value);
}

function parseRunSortColumn(
  value: string | null,
): DashboardRunSortBy | undefined {
  if (isRunSortColumn(value)) {
    return value;
  }

  return undefined;
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

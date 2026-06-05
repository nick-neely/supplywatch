import type { WatcherDashboardSummary } from "@supplywatch/state";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import "./styles.css";

export type SummaryFetcher = () => Promise<WatcherDashboardSummary>;

export type AppProps = {
  fetchSummary?: SummaryFetcher;
  refreshIntervalMs?: number;
};

const DEFAULT_REFRESH_INTERVAL_MS = 15_000;

export function App({
  fetchSummary = fetchSummaryFromApi,
  refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS,
}: AppProps) {
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
    <main className="dashboard-shell">
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
    </main>
  );
}

async function fetchSummaryFromApi(): Promise<WatcherDashboardSummary> {
  const response = await fetch("/api/summary");

  if (!response.ok) {
    throw new Error(`Summary request failed with HTTP ${response.status}`);
  }

  return (await response.json()) as WatcherDashboardSummary;
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

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "none";
  }

  return `${value.slice(11, 19)} UTC`;
}

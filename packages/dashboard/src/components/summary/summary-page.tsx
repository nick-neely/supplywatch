import type { WatcherDashboardSummary } from "@supplywatch/state";
import { useCallback, useState } from "react";
import { fetchSummaryFromApi } from "@/client/api/fetchers";
import { useDashboardRefresh } from "@/client/hooks/use-dashboard-refresh";
import type { SummaryFetcher } from "@/client/types";
import { ErrorPanel, LoadingPanel } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import { DetailField, StatusChip } from "@/components/shared/ledger";
import { SummaryPanel } from "@/components/shared/product-display";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { errorMessage } from "@/lib/error-message";
import { formatTimestamp } from "@/lib/format-timestamp";

type SummaryPageProps = {
  fetchSummary?: SummaryFetcher;
  refreshIntervalMs: number;
};

export function SummaryPage({
  fetchSummary = fetchSummaryFromApi,
  refreshIntervalMs,
}: SummaryPageProps) {
  const [summary, setSummary] = useState<WatcherDashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { isRefreshing, refreshNow } = useDashboardRefresh(
    useCallback(
      async (isMounted) => {
        setError(null);

        try {
          const nextSummary = await fetchSummary();
          if (isMounted()) {
            setSummary(nextSummary);
          }
        } catch (caught) {
          if (isMounted()) {
            setError(errorMessage(caught));
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
              <p className="sw-empty-note">No stale-looking running Run.</p>
            )}
            <dl className="sw-detail-list">
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
              <p className="sw-empty-note">No persisted health Events.</p>
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

      <footer className="sw-table-summary">
        Last refreshed:{" "}
        {summary ? formatTimestamp(summary.generatedAt) : "not yet"}
      </footer>
    </div>
  );
}

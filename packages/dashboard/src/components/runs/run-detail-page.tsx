import type { DashboardRunRow } from "@supplywatch/state";
import { useCallback, useState } from "react";
import { fetchRunDetailFromApi } from "@/client/api/fetchers";
import { useDashboardRefresh } from "@/client/hooks/use-dashboard-refresh";
import type { RunDetailFetcher } from "@/client/types";
import { ErrorPanel, LoadingPanel } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import {
  DetailField,
  LedgerSection,
  StatusChip,
} from "@/components/shared/ledger";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { errorMessage } from "@/lib/error-message";
import { formatDuration } from "@/lib/format-duration";
import { formatTimestamp } from "@/lib/format-timestamp";

type RunDetailPageProps = {
  fetchRunDetail?: RunDetailFetcher;
  refreshIntervalMs: number;
  runId: number;
};

export function RunDetailPage({
  fetchRunDetail = fetchRunDetailFromApi,
  refreshIntervalMs,
  runId,
}: RunDetailPageProps) {
  const [run, setRun] = useState<DashboardRunRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { isRefreshing, refreshNow } = useDashboardRefresh(
    useCallback(
      async (isMounted) => {
        try {
          const nextRun = await fetchRunDetail(runId);
          if (isMounted()) {
            setRun(nextRun);
            setError(nextRun ? null : "Run not found");
          }
        } catch (caught) {
          if (isMounted()) {
            setError(errorMessage(caught));
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
      className="flex flex-col gap-6"
      aria-label={`Run ${run.id} detail`}
    >
      <PageHeader
        actionLabel="Refresh Run"
        backHref="/runs"
        backParentLabel="Runs"
        isRefreshing={isRefreshing}
        title={`Run #${run.id}`}
        onRefresh={refreshNow}
      >
        <div className="mt-2">
          <StatusChip value={run.status} />
        </div>
      </PageHeader>

      <div className="sw-ledger">
        <LedgerSection title="Execution">
          {run.staleRunning ? (
            <Alert className="mb-3">
              <AlertDescription>
                This Run looks stale from persisted timestamps:{" "}
                {run.staleRunning.minutesSinceStart} minutes since start.
              </AlertDescription>
            </Alert>
          ) : null}
          <dl className="sw-detail-list">
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
        </LedgerSection>

        <LedgerSection title="Error message">
          {run.errorMessage ? (
            <pre className="sw-evidence-code">{run.errorMessage}</pre>
          ) : (
            <p className="sw-empty-note">
              No error message persisted for this Run.
            </p>
          )}
        </LedgerSection>
      </div>
    </section>
  );
}

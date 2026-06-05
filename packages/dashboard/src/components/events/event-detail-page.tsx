import type { DashboardEventDetail } from "@supplywatch/state";
import { useCallback, useState } from "react";
import { fetchEventDetailFromApi } from "@/client/api/fetchers";
import { useDashboardRefresh } from "@/client/hooks/use-dashboard-refresh";
import type { EventDetailFetcher } from "@/client/types";
import { ErrorPanel, LoadingPanel } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import {
  DetailField,
  LedgerSection,
  StatusChip,
} from "@/components/shared/ledger";
import { EventProductLink } from "@/components/shared/product-display";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { errorMessage } from "@/lib/error-message";
import { isCandidateSignalEvent } from "@/lib/events";
import { formatTimestamp } from "@/lib/format-timestamp";

type EventDetailPageProps = {
  fetchEventDetail?: EventDetailFetcher;
  eventId: number;
  refreshIntervalMs: number;
};

export function EventDetailPage({
  fetchEventDetail = fetchEventDetailFromApi,
  eventId,
  refreshIntervalMs,
}: EventDetailPageProps) {
  const [event, setEvent] = useState<DashboardEventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { isRefreshing, refreshNow } = useDashboardRefresh(
    useCallback(
      async (isMounted) => {
        try {
          const nextEvent = await fetchEventDetail(eventId);
          if (isMounted()) {
            setEvent(nextEvent);
            setError(nextEvent ? null : "Event not found");
          }
        } catch (caught) {
          if (isMounted()) {
            setError(errorMessage(caught));
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
      className="flex flex-col gap-6"
      aria-label={`Event ${event.id} detail`}
    >
      <PageHeader
        actionLabel="Refresh Event"
        backHref="/events"
        backParentLabel="Events"
        isRefreshing={isRefreshing}
        title={event.eventType}
        onRefresh={refreshNow}
      >
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusChip value={event.notificationStatus} />
          <span className="font-mono text-xs text-muted-foreground">
            Event #{event.id}
          </span>
        </div>
      </PageHeader>

      <div className="sw-ledger">
        <LedgerSection title="Delivery state">
          {isCandidateSignalEvent(event.eventType) ? (
            <Alert className="mb-3">
              <AlertDescription>
                Candidate evidence, not confirmed availability.
              </AlertDescription>
            </Alert>
          ) : null}
          <dl className="sw-detail-list">
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
        </LedgerSection>

        <LedgerSection title="Payload JSON">
          <pre className="sw-evidence-code">
            {JSON.stringify(event.payload, null, 2)}
          </pre>
        </LedgerSection>

        <LedgerSection title="Notification error">
          {event.notificationError ? (
            <pre className="sw-evidence-code">{event.notificationError}</pre>
          ) : (
            <p className="sw-empty-note">
              No notification error persisted for this Event.
            </p>
          )}
        </LedgerSection>
      </div>
    </section>
  );
}

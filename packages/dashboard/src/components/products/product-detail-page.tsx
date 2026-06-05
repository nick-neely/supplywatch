import type { DashboardProductDetail } from "@supplywatch/state";
import { ExternalLinkIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { fetchProductDetailFromApi } from "@/client/api/fetchers";
import { useDashboardRefresh } from "@/client/hooks/use-dashboard-refresh";
import type { ProductDetailFetcher } from "@/client/types";
import { ErrorPanel, LoadingPanel } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import {
  ChipList,
  DetailField,
  LedgerSection,
  StatusChip,
} from "@/components/shared/ledger";
import { ProductImage } from "@/components/shared/product-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { availabilityLabel } from "@/lib/availability";
import { errorMessage } from "@/lib/error-message";
import { formatTimestamp } from "@/lib/format-timestamp";
import { truncateStableId } from "@/lib/truncate-stable-id";

type ProductDetailPageProps = {
  fetchProductDetail?: ProductDetailFetcher;
  refreshIntervalMs: number;
  stableId: string;
};

export function ProductDetailPage({
  fetchProductDetail = fetchProductDetailFromApi,
  refreshIntervalMs,
  stableId,
}: ProductDetailPageProps) {
  const [product, setProduct] = useState<DashboardProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSnapshotOpen, setIsSnapshotOpen] = useState(false);

  const { isRefreshing, refreshNow } = useDashboardRefresh(
    useCallback(
      async (isMounted) => {
        try {
          const nextProduct = await fetchProductDetail(stableId);
          if (isMounted()) {
            setProduct(nextProduct);
            setError(nextProduct ? null : "Product not found");
          }
        } catch (caught) {
          if (isMounted()) {
            setError(errorMessage(caught));
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
    <article className="flex flex-col gap-6">
      <PageHeader
        actionLabel="Refresh Product"
        backHref="/products"
        backParentLabel="Products"
        isRefreshing={isRefreshing}
        secondaryActions={
          product.sourceUrl ? (
            <Button asChild size="sm" variant="outline">
              <a href={product.sourceUrl} target="_blank" rel="noreferrer">
                <ExternalLinkIcon data-icon="inline-start" />
                Open source
              </a>
            </Button>
          ) : undefined
        }
        title={product.name ?? product.stableId}
        onRefresh={refreshNow}
      >
        <p className="sw-subtitle" title={product.stableId}>
          {truncateStableId(product.stableId)}
        </p>
      </PageHeader>

      <div className="sw-product-hero">
        <ProductImage product={product} />
        <div className="sw-product-hero-meta">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip value={availabilityLabel(product.availabilityState)} />
            <Badge className="sw-status sw-status--neutral" variant="outline">
              {product.isRetired ? "retired" : "active"}
            </Badge>
          </div>
          <dl className="sw-product-hero-facts">
            <DetailField label="Collection">
              {product.collection ?? "none"}
            </DetailField>
            <DetailField label="Price">{product.price ?? "none"}</DetailField>
            <DetailField label="Available sizes">
              {product.availableSizes.length > 0
                ? product.availableSizes.join(", ")
                : "none"}
            </DetailField>
            <DetailField label="Last seen">
              {formatTimestamp(product.lastSeenAt)}
            </DetailField>
          </dl>
        </div>
      </div>

      <div className="sw-ledger">
        <LedgerSection title="Curated state">
          <dl className="sw-detail-list">
            <DetailField label="Availability state">
              <StatusChip
                value={availabilityLabel(product.availabilityState)}
              />
            </DetailField>
            <DetailField label="First seen">
              {formatTimestamp(product.firstSeenAt)}
            </DetailField>
            <DetailField label="First public">
              {formatTimestamp(product.firstPublicAt)}
            </DetailField>
            <DetailField label="Out-of-stock confirmations">
              {product.outOfStockConfirmations}
            </DetailField>
          </dl>
        </LedgerSection>

        <LedgerSection title="Product overrides">
          {product.override ? (
            <div className="flex flex-col gap-3">
              <ChipList values={product.overrideBadges} />
              {product.override.annotation ? (
                <p className="sw-ledger-note">{product.override.annotation}</p>
              ) : null}
            </div>
          ) : (
            <p className="sw-empty-note">No Product override is recorded.</p>
          )}
        </LedgerSection>

        <LedgerSection title="Recent Product Events">
          {product.recentEvents.length > 0 ? (
            <ul className="sw-event-list">
              {product.recentEvents.map((event) => (
                <li className="sw-event-list-item" key={event.id}>
                  <a
                    className="sw-event-list-type"
                    href={`/events/${event.id}`}
                  >
                    {event.eventType}
                  </a>
                  <StatusChip value={event.notificationStatus} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="sw-empty-note">No recent Product Events.</p>
          )}
        </LedgerSection>

        <LedgerSection title="Snapshot and fingerprint">
          <Collapsible open={isSnapshotOpen} onOpenChange={setIsSnapshotOpen}>
            <p className="sw-ledger-note">
              Raw normalized evidence for auditing questionable classifications.
            </p>
            <CollapsibleTrigger asChild>
              <Button
                className="mt-3"
                size="sm"
                type="button"
                variant="outline"
              >
                {isSnapshotOpen ? "Hide evidence" : "Show evidence"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="sw-evidence-code mt-3">
                {JSON.stringify(
                  {
                    normalizedSnapshot: product.normalizedSnapshot,
                    rawFingerprint: product.rawFingerprint,
                  },
                  null,
                  2,
                )}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        </LedgerSection>
      </div>
    </article>
  );
}

import { createHash } from "node:crypto";
import type { DetailInspectionResult } from "../detail/inspection.js";
import type { DiscoveredProduct } from "../discovery/products.js";
import type {
  BuyableState,
  EventRecord,
  PersistedEventRecord,
  ProductOverride,
  ProductRecord,
  WatcherStateRepository,
} from "./repository.js";

export type ProductSnapshotDiffInput = {
  product: DiscoveredProduct;
  inspection: DetailInspectionResult | null;
  observedAt: string;
  retireAfterOutOfStockConfirmations?: number;
};

export type ProductSnapshotDiffResult = {
  product: ProductRecord;
  events: PersistedEventRecord[];
  existing: ProductRecord | null;
  override: ProductOverride | null;
};

export type ProductInspectionDecisionInput = {
  product: DiscoveredProduct;
  existing: ProductRecord | null;
  override: ProductOverride | null;
};

type ProductSnapshotEventType =
  | "override_applied"
  | "candidate_signal_observed"
  | "out_of_stock_confirmed"
  | "product_retired"
  | "product_unretired"
  | "public_purchase_available"
  | "newly_available_size"
  | "likely_restock";

const DEFAULT_RETIRE_AFTER_OUT_OF_STOCK_CONFIRMATIONS = 3;
const MERCH_EVENT_TYPES: ReadonlySet<ProductSnapshotEventType> = new Set([
  "public_purchase_available",
  "newly_available_size",
  "likely_restock",
]);

export function shouldInspectProductSnapshot({
  product,
  existing,
  override,
}: ProductInspectionDecisionInput): boolean {
  if (override?.forceWatched) {
    return true;
  }

  if (override?.denylisted) {
    return false;
  }

  if (!existing?.retiredAt) {
    return true;
  }

  if (override?.forceRetired) {
    return false;
  }

  return hasStrongCardChange(product, existing);
}

export function diffProductSnapshot(
  repository: WatcherStateRepository,
  input: ProductSnapshotDiffInput,
): ProductSnapshotDiffResult {
  const existing = repository.getProduct(input.product.stableId);
  const override = repository.getProductOverride(input.product.stableId);
  const product = productRecordFromSnapshot(input, existing, override);

  repository.upsertProduct(product);

  const events = domainEvents(input, product, existing, override).map((event) =>
    repository.recordEvent(event),
  );

  return {
    product,
    events,
    existing,
    override,
  };
}

function productRecordFromSnapshot(
  input: ProductSnapshotDiffInput,
  existing: ProductRecord | null,
  override: ProductOverride | null,
): ProductRecord {
  const inspectionBuyableState = buyableStateFromInspection(
    input.inspection,
    existing,
  );
  const buyableState = override?.knownEmployeeOnly
    ? "employee_only"
    : inspectionBuyableState;
  const availableSizes = override?.knownEmployeeOnly
    ? (existing?.availableSizes ?? [])
    : (input.inspection?.availableSizes ?? existing?.availableSizes ?? []);
  const normalizedSnapshot = normalizedProductSnapshot(
    input.product,
    input.inspection,
    override,
  );
  const outOfStockConfirmations = outOfStockConfirmationCount(
    input.inspection,
    existing,
    override,
  );
  const retirement = retirementState({
    product: input.product,
    existing,
    override,
    observedAt: input.observedAt,
    buyableState,
    outOfStockConfirmations,
    retireAfterOutOfStockConfirmations:
      input.retireAfterOutOfStockConfirmations ??
      DEFAULT_RETIRE_AFTER_OUT_OF_STOCK_CONFIRMATIONS,
  });
  const isFirstPublicObservation =
    buyableState === "publicly_buyable" && !existing?.firstPublicAt;

  return {
    stableId: input.product.stableId,
    name: input.product.name,
    url: input.product.url,
    imageUrl: input.product.imageUrl,
    description: input.product.description,
    collection: input.product.collection,
    price: input.product.price,
    normalizedSnapshot,
    rawFingerprint: fingerprintSnapshot(normalizedSnapshot),
    buyableState,
    availableSizes,
    firstSeenAt: existing?.firstSeenAt ?? input.observedAt,
    lastSeenAt: input.observedAt,
    firstPublicAt:
      existing?.firstPublicAt ??
      (isFirstPublicObservation ? input.observedAt : null),
    outOfStockConfirmations,
    retiredAt: retirement.retiredAt,
    retirementReason: retirement.retirementReason,
  };
}

function domainEvents(
  input: ProductSnapshotDiffInput,
  current: ProductRecord,
  existing: ProductRecord | null,
  override: ProductOverride | null,
): EventRecord[] {
  const events: EventRecord[] = [];
  const canNotifyAvailability = canCreateMerchAvailabilityEvent(
    current,
    override,
  );

  if (override && hasActiveOverride(override)) {
    events.push(
      buildEvent({
        eventType: "override_applied",
        product: current,
        observedAt: input.observedAt,
        dedupeKey: stableJson(override),
        payload: {
          productName: current.name,
          override,
          buyableState: current.buyableState,
          retiredAt: current.retiredAt,
          retirementReason: current.retirementReason,
        },
      }),
    );
  }

  if (input.product.candidateEvidence.length > 0) {
    events.push(
      buildEvent({
        eventType: "candidate_signal_observed",
        product: current,
        observedAt: input.observedAt,
        dedupeKey: input.product.rawFingerprint,
        payload: {
          productName: current.name,
          candidateEvidence: input.product.candidateEvidence,
        },
      }),
    );
  }

  if (input.inspection && current.buyableState === "out_of_stock") {
    events.push(
      buildEvent({
        eventType: "out_of_stock_confirmed",
        product: current,
        observedAt: input.observedAt,
        dedupeKey: String(current.outOfStockConfirmations),
        payload: {
          productName: current.name,
          outOfStockConfirmations: current.outOfStockConfirmations,
          evidence: input.inspection.evidence,
        },
      }),
    );
  }

  if (!existing?.retiredAt && current.retiredAt) {
    events.push(
      buildEvent({
        eventType: "product_retired",
        product: current,
        observedAt: input.observedAt,
        dedupeKey: current.retirementReason ?? current.retiredAt,
        payload: {
          productName: current.name,
          outOfStockConfirmations: current.outOfStockConfirmations,
          retirementReason: current.retirementReason,
        },
      }),
    );
  }

  if (existing?.retiredAt && !current.retiredAt) {
    events.push(
      buildEvent({
        eventType: "product_unretired",
        product: current,
        observedAt: input.observedAt,
        dedupeKey: input.product.rawFingerprint,
        payload: {
          productName: current.name,
          previousRetirementReason: existing.retirementReason,
          candidateEvidence: input.product.candidateEvidence,
        },
      }),
    );
  }

  if (
    shouldRecordPublicPurchaseEvent(current, existing) &&
    canNotifyAvailability
  ) {
    events.push(
      buildEvent({
        eventType: "public_purchase_available",
        product: current,
        observedAt: input.observedAt,
        dedupeKey:
          current.rawFingerprint ?? stableJson(current.normalizedSnapshot),
        payload: publicPurchasePayload(input, current, existing),
      }),
    );
  }

  const newlyAvailableSizes = current.availableSizes.filter(
    (size) => !existing?.availableSizes.includes(size),
  );

  if (canNotifyAvailability && existing && newlyAvailableSizes.length > 0) {
    events.push(
      buildEvent({
        eventType: "newly_available_size",
        product: current,
        observedAt: input.observedAt,
        dedupeKey: newlyAvailableSizes.join("|"),
        payload: {
          ...publicPurchasePayload(input, current, existing),
          newlyAvailableSizes,
        },
      }),
    );
  }

  if (canNotifyAvailability && existing?.buyableState === "out_of_stock") {
    events.push(
      buildEvent({
        eventType: "likely_restock",
        product: current,
        observedAt: input.observedAt,
        dedupeKey: current.rawFingerprint ?? "unknown-fingerprint",
        payload: publicPurchasePayload(input, current, existing),
      }),
    );
  }

  return events;
}

function buildEvent(options: {
  eventType: ProductSnapshotEventType;
  product: ProductRecord;
  observedAt: string;
  dedupeKey: string;
  payload: Record<string, unknown>;
}): EventRecord {
  const isMerchEvent = MERCH_EVENT_TYPES.has(options.eventType);

  return {
    eventHash: hash(
      stableJson({
        eventType: options.eventType,
        productId: options.product.stableId,
        dedupeKey: options.dedupeKey,
      }),
    ),
    eventType: options.eventType,
    productId: options.product.stableId,
    payload: {
      alertKind: isMerchEvent ? "merch" : "state_evidence",
      productId: options.product.stableId,
      observedAt: options.observedAt,
      ...options.payload,
    },
    notificationStatus: isMerchEvent ? "pending" : "dry_run",
    attemptCount: 0,
    lastAttemptAt: null,
    notificationError: null,
    createdAt: options.observedAt,
    notifiedAt: null,
  };
}

function shouldRecordPublicPurchaseEvent(
  current: ProductRecord,
  existing: ProductRecord | null,
): boolean {
  return (
    current.buyableState === "publicly_buyable" &&
    (existing?.buyableState !== "publicly_buyable" ||
      current.rawFingerprint === existing.rawFingerprint)
  );
}

function canCreateMerchAvailabilityEvent(
  current: ProductRecord,
  override: ProductOverride | null,
): boolean {
  return (
    current.buyableState === "publicly_buyable" &&
    !override?.denylisted &&
    !override?.knownEmployeeOnly
  );
}

function publicPurchasePayload(
  input: ProductSnapshotDiffInput,
  current: ProductRecord,
  existing: ProductRecord | null,
): Record<string, unknown> {
  return {
    transition: existing
      ? "became_publicly_buyable"
      : "new_public_purchase_available",
    productName: current.name,
    productUrl: current.url,
    imageUrl: current.imageUrl,
    description: current.description,
    price: current.price,
    availableSizes: current.availableSizes,
    confidence: input.inspection?.confidence ?? "low",
    evidence: input.inspection?.evidence ?? [],
    previousBuyableState: existing?.buyableState ?? null,
    currentBuyableState: current.buyableState,
    verificationBoundary: input.inspection?.verificationBoundary ?? null,
  };
}

function normalizedProductSnapshot(
  product: DiscoveredProduct,
  inspection: DetailInspectionResult | null,
  override: ProductOverride | null,
): ProductRecord["normalizedSnapshot"] {
  const snapshot = inspection
    ? {
        ...product.normalizedSnapshot,
        detail: {
          buyable: inspection.buyable,
          confidence: inspection.confidence,
          availableSizes: inspection.availableSizes,
          disabledSizes: inspection.disabledSizes,
          actionEvidence: inspection.actionEvidence,
          detailText: inspection.detailText,
          evidence: inspection.evidence,
          productUrl: inspection.productUrl,
        },
      }
    : product.normalizedSnapshot;

  if (!override || !hasActiveOverride(override)) {
    return snapshot;
  }

  return {
    ...snapshot,
    override: {
      denylisted: override.denylisted,
      forceRetired: override.forceRetired,
      forceWatched: override.forceWatched,
      knownEmployeeOnly: override.knownEmployeeOnly,
      annotation: override.annotation,
    },
  };
}

function buyableStateFromInspection(
  inspection: DetailInspectionResult | null,
  existing: ProductRecord | null,
): BuyableState {
  if (!inspection) {
    return existing?.buyableState ?? "unknown";
  }

  if (inspection.buyable) {
    return "publicly_buyable";
  }

  const hasEmployeeGate = inspection.detectors.some(
    (detector) => detector.name === "employee-gated" && detector.matched,
  );

  return hasEmployeeGate ? "employee_only" : "out_of_stock";
}

function outOfStockConfirmationCount(
  inspection: DetailInspectionResult | null,
  existing: ProductRecord | null,
  override: ProductOverride | null,
): number {
  if (override?.knownEmployeeOnly) {
    return existing?.outOfStockConfirmations ?? 0;
  }

  if (!inspection) {
    return existing?.outOfStockConfirmations ?? 0;
  }

  const buyableState = buyableStateFromInspection(inspection, existing);

  if (buyableState === "out_of_stock") {
    return (existing?.outOfStockConfirmations ?? 0) + 1;
  }

  if (buyableState === "publicly_buyable") {
    return 0;
  }

  return existing?.outOfStockConfirmations ?? 0;
}

function retirementState(options: {
  product: DiscoveredProduct;
  existing: ProductRecord | null;
  override: ProductOverride | null;
  observedAt: string;
  buyableState: BuyableState;
  outOfStockConfirmations: number;
  retireAfterOutOfStockConfirmations: number;
}): Pick<ProductRecord, "retiredAt" | "retirementReason"> {
  if (options.override?.forceRetired) {
    return {
      retiredAt: options.observedAt,
      retirementReason: "override:force_retired",
    };
  }

  if (
    options.override?.forceWatched ||
    options.buyableState === "publicly_buyable"
  ) {
    return {
      retiredAt: null,
      retirementReason: null,
    };
  }

  if (
    options.existing?.retiredAt &&
    hasStrongCardChange(options.product, options.existing)
  ) {
    return {
      retiredAt: null,
      retirementReason: null,
    };
  }

  if (
    options.outOfStockConfirmations >=
    options.retireAfterOutOfStockConfirmations
  ) {
    return {
      retiredAt: options.existing?.retiredAt ?? options.observedAt,
      retirementReason:
        options.existing?.retirementReason ??
        "three_out_of_stock_confirmations",
    };
  }

  return {
    retiredAt: options.existing?.retiredAt ?? null,
    retirementReason: options.existing?.retirementReason ?? null,
  };
}

function hasStrongCardChange(
  product: DiscoveredProduct,
  existing: ProductRecord,
): boolean {
  return (
    product.rawFingerprint !== existing.rawFingerprint ||
    product.stableId !== existing.stableId ||
    product.url !== existing.url ||
    product.imageUrl !== existing.imageUrl ||
    product.name !== existing.name ||
    product.candidateEvidence.length > 0
  );
}

function hasActiveOverride(override: ProductOverride): boolean {
  return (
    override.denylisted ||
    override.forceRetired ||
    override.forceWatched ||
    override.knownEmployeeOnly ||
    Boolean(override.annotation)
  );
}

function fingerprintSnapshot(
  snapshot: ProductRecord["normalizedSnapshot"],
): string {
  const { observedAt: _observedAt, ...stableSnapshot } = snapshot;

  return hash(stableJson(stableSnapshot));
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

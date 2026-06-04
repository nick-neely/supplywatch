import type Database from "better-sqlite3";
import { initializeStateSchema } from "./schema.js";

export type JsonObject = Record<string, unknown>;

export type BuyableState =
  | "unknown"
  | "out_of_stock"
  | "publicly_buyable"
  | "employee_only";

export type ProductRecord = {
  stableId: string;
  name: string | null;
  url: string | null;
  imageUrl: string | null;
  description: string | null;
  collection: string | null;
  price: string | null;
  normalizedSnapshot: JsonObject;
  rawFingerprint: string | null;
  buyableState: BuyableState;
  availableSizes: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  firstPublicAt: string | null;
  outOfStockConfirmations: number;
  retiredAt: string | null;
  retirementReason: string | null;
};

export type NotificationStatus = "pending" | "sent" | "failed" | "dry_run";

export type EventRecord = {
  id?: number;
  eventHash: string;
  eventType: string;
  productId: string | null;
  payload: JsonObject;
  notificationStatus: NotificationStatus;
  attemptCount: number;
  lastAttemptAt: string | null;
  notificationError: string | null;
  createdAt: string;
  notifiedAt: string | null;
};

export type RunStatus = "running" | "completed" | "failed";

export type RunRecord = {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: RunStatus;
  productCount: number;
  errorMessage: string | null;
};

export type ProductOverride = {
  productId: string;
  denylisted: boolean;
  forceRetired: boolean;
  forceWatched: boolean;
  knownEmployeeOnly: boolean;
  annotation: string | null;
};

type ProductRow = {
  stable_id: string;
  name: string | null;
  url: string | null;
  image_url: string | null;
  description: string | null;
  collection: string | null;
  price: string | null;
  normalized_snapshot_json: string;
  raw_fingerprint: string | null;
  buyable_state: BuyableState;
  available_sizes_json: string;
  first_seen_at: string;
  last_seen_at: string;
  first_public_at: string | null;
  out_of_stock_confirmations: number;
  retired_at: string | null;
  retirement_reason: string | null;
};

type EventRow = {
  id: number;
  event_hash: string;
  event_type: string;
  product_id: string | null;
  payload_json: string;
  notification_status: NotificationStatus;
  attempt_count: number;
  last_attempt_at: string | null;
  notification_error: string | null;
  created_at: string;
  notified_at: string | null;
};

type RunRow = {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: RunStatus;
  product_count: number;
  error_message: string | null;
};

type ProductOverrideRow = {
  product_id: string;
  denylisted: 0 | 1;
  force_retired: 0 | 1;
  force_watched: 0 | 1;
  known_employee_only: 0 | 1;
  annotation: string | null;
};

export class WatcherStateRepository {
  readonly #database: Database.Database;

  constructor(database: Database.Database) {
    this.#database = database;
    initializeStateSchema(database);
  }

  upsertProduct(product: ProductRecord): void {
    this.#database
      .prepare(`
        INSERT INTO products (
          stable_id,
          name,
          url,
          image_url,
          description,
          collection,
          price,
          normalized_snapshot_json,
          raw_fingerprint,
          buyable_state,
          available_sizes_json,
          first_seen_at,
          last_seen_at,
          first_public_at,
          out_of_stock_confirmations,
          retired_at,
          retirement_reason,
          updated_at
        )
        VALUES (
          @stableId,
          @name,
          @url,
          @imageUrl,
          @description,
          @collection,
          @price,
          @normalizedSnapshotJson,
          @rawFingerprint,
          @buyableState,
          @availableSizesJson,
          @firstSeenAt,
          @lastSeenAt,
          @firstPublicAt,
          @outOfStockConfirmations,
          @retiredAt,
          @retirementReason,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT(stable_id) DO UPDATE SET
          name = excluded.name,
          url = excluded.url,
          image_url = excluded.image_url,
          description = excluded.description,
          collection = excluded.collection,
          price = excluded.price,
          normalized_snapshot_json = excluded.normalized_snapshot_json,
          raw_fingerprint = excluded.raw_fingerprint,
          buyable_state = excluded.buyable_state,
          available_sizes_json = excluded.available_sizes_json,
          first_seen_at = products.first_seen_at,
          last_seen_at = excluded.last_seen_at,
          first_public_at = COALESCE(products.first_public_at, excluded.first_public_at),
          out_of_stock_confirmations = excluded.out_of_stock_confirmations,
          retired_at = excluded.retired_at,
          retirement_reason = excluded.retirement_reason,
          updated_at = CURRENT_TIMESTAMP
      `)
      .run({
        ...product,
        normalizedSnapshotJson: JSON.stringify(product.normalizedSnapshot),
        availableSizesJson: JSON.stringify(product.availableSizes),
      });
  }

  getProduct(stableId: string): ProductRecord | null {
    const row = this.#database
      .prepare("SELECT * FROM products WHERE stable_id = ?")
      .get(stableId) as ProductRow | undefined;

    return row ? mapProductRow(row) : null;
  }

  recordEvent(event: EventRecord): EventRecord & { id: number } {
    this.#database
      .prepare(`
        INSERT OR IGNORE INTO events (
          event_hash,
          event_type,
          product_id,
          payload_json,
          notification_status,
          attempt_count,
          last_attempt_at,
          notification_error,
          created_at,
          notified_at
        )
        VALUES (
          @eventHash,
          @eventType,
          @productId,
          @payloadJson,
          @notificationStatus,
          @attemptCount,
          @lastAttemptAt,
          @notificationError,
          @createdAt,
          @notifiedAt
        )
      `)
      .run({
        ...event,
        payloadJson: JSON.stringify(event.payload),
      });

    const persisted = this.getEventByHash(event.eventHash);
    if (!persisted) {
      throw new Error(`Failed to record event ${event.eventHash}`);
    }

    return persisted;
  }

  getEventByHash(eventHash: string): (EventRecord & { id: number }) | null {
    const row = this.#database
      .prepare("SELECT * FROM events WHERE event_hash = ?")
      .get(eventHash) as EventRow | undefined;

    return row ? mapEventRow(row) : null;
  }

  startRun(startedAt: string): RunRecord {
    const result = this.#database
      .prepare(`
        INSERT INTO runs (started_at, status)
        VALUES (?, 'running')
      `)
      .run(startedAt);

    const run = this.getRun(Number(result.lastInsertRowid));
    if (!run) {
      throw new Error("Failed to start run");
    }

    return run;
  }

  finishRun(
    id: number,
    completion: {
      finishedAt: string;
      status: Exclude<RunStatus, "running">;
      productCount: number;
      errorMessage: string | null;
    },
  ): void {
    this.#database
      .prepare(`
        UPDATE runs
        SET
          finished_at = @finishedAt,
          status = @status,
          product_count = @productCount,
          error_message = @errorMessage
        WHERE id = @id
      `)
      .run({ id, ...completion });
  }

  getRun(id: number): RunRecord | null {
    const row = this.#database
      .prepare("SELECT * FROM runs WHERE id = ?")
      .get(id) as RunRow | undefined;

    return row ? mapRunRow(row) : null;
  }

  setProductOverride(override: ProductOverride): void {
    this.#database
      .prepare(`
        INSERT INTO product_overrides (
          product_id,
          denylisted,
          force_retired,
          force_watched,
          known_employee_only,
          annotation,
          updated_at
        )
        VALUES (
          @productId,
          @denylisted,
          @forceRetired,
          @forceWatched,
          @knownEmployeeOnly,
          @annotation,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT(product_id) DO UPDATE SET
          denylisted = excluded.denylisted,
          force_retired = excluded.force_retired,
          force_watched = excluded.force_watched,
          known_employee_only = excluded.known_employee_only,
          annotation = excluded.annotation,
          updated_at = CURRENT_TIMESTAMP
      `)
      .run({
        productId: override.productId,
        denylisted: Number(override.denylisted),
        forceRetired: Number(override.forceRetired),
        forceWatched: Number(override.forceWatched),
        knownEmployeeOnly: Number(override.knownEmployeeOnly),
        annotation: override.annotation,
      });
  }

  getProductOverride(productId: string): ProductOverride | null {
    const row = this.#database
      .prepare("SELECT * FROM product_overrides WHERE product_id = ?")
      .get(productId) as ProductOverrideRow | undefined;

    return row ? mapProductOverrideRow(row) : null;
  }
}

function mapProductRow(row: ProductRow): ProductRecord {
  return {
    stableId: row.stable_id,
    name: row.name,
    url: row.url,
    imageUrl: row.image_url,
    description: row.description,
    collection: row.collection,
    price: row.price,
    normalizedSnapshot: JSON.parse(row.normalized_snapshot_json) as JsonObject,
    rawFingerprint: row.raw_fingerprint,
    buyableState: row.buyable_state,
    availableSizes: JSON.parse(row.available_sizes_json) as string[],
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    firstPublicAt: row.first_public_at,
    outOfStockConfirmations: row.out_of_stock_confirmations,
    retiredAt: row.retired_at,
    retirementReason: row.retirement_reason,
  };
}

function mapEventRow(row: EventRow): EventRecord & { id: number } {
  return {
    id: row.id,
    eventHash: row.event_hash,
    eventType: row.event_type,
    productId: row.product_id,
    payload: JSON.parse(row.payload_json) as JsonObject,
    notificationStatus: row.notification_status,
    attemptCount: row.attempt_count,
    lastAttemptAt: row.last_attempt_at,
    notificationError: row.notification_error,
    createdAt: row.created_at,
    notifiedAt: row.notified_at,
  };
}

function mapRunRow(row: RunRow): RunRecord {
  return {
    id: row.id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    status: row.status,
    productCount: row.product_count,
    errorMessage: row.error_message,
  };
}

function mapProductOverrideRow(row: ProductOverrideRow): ProductOverride {
  return {
    productId: row.product_id,
    denylisted: row.denylisted === 1,
    forceRetired: row.force_retired === 1,
    forceWatched: row.force_watched === 1,
    knownEmployeeOnly: row.known_employee_only === 1,
    annotation: row.annotation,
  };
}

import type Database from "better-sqlite3";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { initializeStateSchema } from "./schema.js";
import { events, productOverrides, products, runs } from "./tables.js";
import type { BuyableState, NotificationStatus, RunStatus } from "./types.js";

export type { BuyableState, NotificationStatus, RunStatus };

export type JsonObject = Record<string, unknown>;

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

export type PersistedEventRecord = EventRecord & { id: number };

export type NotificationFailureUpdate = {
  id: number;
  attemptCount: number;
  lastAttemptAt: string;
  notificationError: string;
  failed: boolean;
};

export type RunRecord = {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: RunStatus;
  productCount: number;
  errorMessage: string | null;
};

export type RunCompletion = {
  finishedAt: string;
  status: Exclude<RunStatus, "running">;
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

type ProductRow = typeof products.$inferSelect;
type EventRow = typeof events.$inferSelect;
type RunRow = typeof runs.$inferSelect;
type ProductOverrideRow = typeof productOverrides.$inferSelect;

export class WatcherStateRepository {
  readonly #db: ReturnType<typeof drizzle>;

  constructor(database: Database.Database) {
    initializeStateSchema(database);
    this.#db = drizzle(database);
  }

  upsertProduct(product: ProductRecord): void {
    this.#db
      .insert(products)
      .values({
        stableId: product.stableId,
        name: product.name,
        url: product.url,
        imageUrl: product.imageUrl,
        description: product.description,
        collection: product.collection,
        price: product.price,
        normalizedSnapshotJson: JSON.stringify(product.normalizedSnapshot),
        rawFingerprint: product.rawFingerprint,
        buyableState: product.buyableState,
        availableSizesJson: JSON.stringify(product.availableSizes),
        firstSeenAt: product.firstSeenAt,
        lastSeenAt: product.lastSeenAt,
        firstPublicAt: product.firstPublicAt,
        outOfStockConfirmations: product.outOfStockConfirmations,
        retiredAt: product.retiredAt,
        retirementReason: product.retirementReason,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .onConflictDoUpdate({
        target: products.stableId,
        set: {
          name: sql`excluded.name`,
          url: sql`excluded.url`,
          imageUrl: sql`excluded.image_url`,
          description: sql`excluded.description`,
          collection: sql`excluded.collection`,
          price: sql`excluded.price`,
          normalizedSnapshotJson: sql`excluded.normalized_snapshot_json`,
          rawFingerprint: sql`excluded.raw_fingerprint`,
          buyableState: sql`excluded.buyable_state`,
          availableSizesJson: sql`excluded.available_sizes_json`,
          firstSeenAt: products.firstSeenAt,
          lastSeenAt: sql`excluded.last_seen_at`,
          firstPublicAt: sql`COALESCE(${products.firstPublicAt}, excluded.first_public_at)`,
          outOfStockConfirmations: sql`excluded.out_of_stock_confirmations`,
          retiredAt: sql`excluded.retired_at`,
          retirementReason: sql`excluded.retirement_reason`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      })
      .run();
  }

  getProduct(stableId: string): ProductRecord | null {
    const row = this.#db
      .select()
      .from(products)
      .where(eq(products.stableId, stableId))
      .get();

    return row ? mapProductRow(row) : null;
  }

  recordEvent(event: EventRecord): PersistedEventRecord {
    this.#db
      .insert(events)
      .values({
        eventHash: event.eventHash,
        eventType: event.eventType,
        productId: event.productId,
        payloadJson: JSON.stringify(event.payload),
        notificationStatus: event.notificationStatus,
        attemptCount: event.attemptCount,
        lastAttemptAt: event.lastAttemptAt,
        notificationError: event.notificationError,
        createdAt: event.createdAt,
        notifiedAt: event.notifiedAt,
      })
      .onConflictDoNothing()
      .run();

    const persisted = this.getEventByHash(event.eventHash);
    if (!persisted) {
      throw new Error(`Failed to record event ${event.eventHash}`);
    }

    return persisted;
  }

  getEventByHash(eventHash: string): PersistedEventRecord | null {
    const row = this.#db
      .select()
      .from(events)
      .where(eq(events.eventHash, eventHash))
      .get();

    return row ? mapEventRow(row) : null;
  }

  listPendingNotificationEvents(): PersistedEventRecord[] {
    return this.#db
      .select()
      .from(events)
      .where(inArray(events.notificationStatus, ["pending", "dry_run"]))
      .orderBy(asc(events.createdAt), asc(events.id))
      .all()
      .map(mapEventRow);
  }

  markNotificationDryRun(id: number, notifiedAt: string): void {
    this.#markNotificationResolved(id, "dry_run", notifiedAt);
  }

  markNotificationSent(id: number, notifiedAt: string): void {
    this.#markNotificationResolved(id, "sent", notifiedAt);
  }

  #markNotificationResolved(
    id: number,
    notificationStatus: Extract<NotificationStatus, "dry_run" | "sent">,
    notifiedAt: string,
  ): void {
    this.#db
      .update(events)
      .set({
        notificationStatus,
        notificationError: null,
        notifiedAt,
      })
      .where(eq(events.id, id))
      .run();
  }

  recordNotificationFailure(update: NotificationFailureUpdate): void {
    this.#db
      .update(events)
      .set({
        attemptCount: update.attemptCount,
        lastAttemptAt: update.lastAttemptAt,
        notificationError: update.notificationError,
        notificationStatus: update.failed ? "failed" : "pending",
      })
      .where(eq(events.id, update.id))
      .run();
  }

  startRun(startedAt: string): RunRecord {
    const inserted = this.#db
      .insert(runs)
      .values({ startedAt, status: "running" })
      .returning()
      .get();

    const run = this.getRun(inserted.id);
    if (!run) {
      throw new Error("Failed to start run");
    }

    return run;
  }

  finishRun(id: number, completion: RunCompletion): void {
    this.#db.update(runs).set(completion).where(eq(runs.id, id)).run();
  }

  getRun(id: number): RunRecord | null {
    const row = this.#db.select().from(runs).where(eq(runs.id, id)).get();

    return row ? mapRunRow(row) : null;
  }

  setProductOverride(override: ProductOverride): void {
    this.#db
      .insert(productOverrides)
      .values({
        productId: override.productId,
        denylisted: override.denylisted,
        forceRetired: override.forceRetired,
        forceWatched: override.forceWatched,
        knownEmployeeOnly: override.knownEmployeeOnly,
        annotation: override.annotation,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .onConflictDoUpdate({
        target: productOverrides.productId,
        set: {
          denylisted: sql`excluded.denylisted`,
          forceRetired: sql`excluded.force_retired`,
          forceWatched: sql`excluded.force_watched`,
          knownEmployeeOnly: sql`excluded.known_employee_only`,
          annotation: sql`excluded.annotation`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      })
      .run();
  }

  getProductOverride(productId: string): ProductOverride | null {
    const row = this.#db
      .select()
      .from(productOverrides)
      .where(eq(productOverrides.productId, productId))
      .get();

    return row ? mapProductOverrideRow(row) : null;
  }
}

function mapProductRow(row: ProductRow): ProductRecord {
  return {
    stableId: row.stableId,
    name: row.name,
    url: row.url,
    imageUrl: row.imageUrl,
    description: row.description,
    collection: row.collection,
    price: row.price,
    normalizedSnapshot: JSON.parse(row.normalizedSnapshotJson) as JsonObject,
    rawFingerprint: row.rawFingerprint,
    buyableState: row.buyableState,
    availableSizes: JSON.parse(row.availableSizesJson) as string[],
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
    firstPublicAt: row.firstPublicAt,
    outOfStockConfirmations: row.outOfStockConfirmations,
    retiredAt: row.retiredAt,
    retirementReason: row.retirementReason,
  };
}

function mapEventRow(row: EventRow): PersistedEventRecord {
  return {
    id: row.id,
    eventHash: row.eventHash,
    eventType: row.eventType,
    productId: row.productId,
    payload: JSON.parse(row.payloadJson) as JsonObject,
    notificationStatus: row.notificationStatus,
    attemptCount: row.attemptCount,
    lastAttemptAt: row.lastAttemptAt,
    notificationError: row.notificationError,
    createdAt: row.createdAt,
    notifiedAt: row.notifiedAt,
  };
}

function mapRunRow(row: RunRow): RunRecord {
  return {
    id: row.id,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    status: row.status,
    productCount: row.productCount,
    errorMessage: row.errorMessage,
  };
}

function mapProductOverrideRow(row: ProductOverrideRow): ProductOverride {
  return {
    productId: row.productId,
    denylisted: row.denylisted,
    forceRetired: row.forceRetired,
    forceWatched: row.forceWatched,
    knownEmployeeOnly: row.knownEmployeeOnly,
    annotation: row.annotation,
  };
}

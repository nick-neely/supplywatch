import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type EventRecord,
  initializeStateSchema,
  openStateRepository,
  type ProductOverride,
  type ProductRecord,
  WatcherStateRepository,
} from "@supplywatch/state";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

const PRODUCT_SNAPSHOT: ProductRecord = {
  stableId: "product-openai-tee",
  name: "OpenAI Tee",
  url: "https://supplyco.openai.com/products/openai-tee",
  imageUrl: "https://cdn.example/openai-tee.png",
  description: "A public product detail snapshot",
  collection: "Apparel",
  price: "$20",
  normalizedSnapshot: {
    stableId: "product-openai-tee",
    name: "OpenAI Tee",
    buyable: true,
  },
  rawFingerprint: "fingerprint-1",
  buyableState: "publicly_buyable",
  availableSizes: ["M", "L"],
  firstSeenAt: "2026-06-04T15:00:00.000Z",
  lastSeenAt: "2026-06-04T15:05:00.000Z",
  firstPublicAt: "2026-06-04T15:05:00.000Z",
  outOfStockConfirmations: 0,
  retiredAt: null,
  retirementReason: null,
};

const BUYABLE_EVENT: EventRecord = {
  eventHash: "public-openai-tee-fingerprint-1",
  eventType: "product_publicly_buyable",
  productId: null,
  payload: {
    productName: "OpenAI Tee",
    confidence: 0.98,
  },
  notificationStatus: "pending",
  attemptCount: 2,
  lastAttemptAt: "2026-06-04T15:10:00.000Z",
  notificationError: "Webhook timeout",
  createdAt: "2026-06-04T15:05:00.000Z",
  notifiedAt: null,
};

const PRODUCT_OVERRIDE: ProductOverride = {
  productId: "product-employee-hoodie",
  denylisted: true,
  forceRetired: false,
  forceWatched: true,
  knownEmployeeOnly: true,
  annotation: "Employee-only product observed during fixture capture",
};

type TableInfoRow = {
  name: string;
};

describe("initializeStateSchema", () => {
  it("creates persistent watcher state tables with required columns", () => {
    const database = new Database(":memory:");

    initializeStateSchema(database);

    const columnsByTable = new Map<string, string[]>();
    for (const table of ["products", "events", "runs", "product_overrides"]) {
      const columns = database
        .prepare<[], TableInfoRow>(`PRAGMA table_info(${table})`)
        .all()
        .map((column) => column.name);
      columnsByTable.set(table, columns);
    }

    expect(columnsByTable.get("products")).toEqual(
      expect.arrayContaining([
        "stable_id",
        "normalized_snapshot_json",
        "buyable_state",
        "available_sizes_json",
        "first_seen_at",
        "last_seen_at",
        "first_public_at",
        "out_of_stock_confirmations",
        "retired_at",
        "retirement_reason",
      ]),
    );
    expect(columnsByTable.get("events")).toEqual(
      expect.arrayContaining([
        "event_hash",
        "payload_json",
        "notification_status",
        "attempt_count",
        "last_attempt_at",
        "notification_error",
        "created_at",
        "notified_at",
      ]),
    );
    expect(columnsByTable.get("runs")).toEqual(
      expect.arrayContaining([
        "started_at",
        "finished_at",
        "status",
        "product_count",
        "error_message",
      ]),
    );
    expect(columnsByTable.get("product_overrides")).toEqual(
      expect.arrayContaining([
        "product_id",
        "denylisted",
        "force_retired",
        "force_watched",
        "known_employee_only",
        "annotation",
      ]),
    );
    expect(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'",
        )
        .get(),
    ).toBeDefined();
  });

  it("adopts an existing pre-Drizzle state schema without replaying the initial migration", () => {
    const database = new Database(":memory:");
    createLegacyStateSchema(database);

    initializeStateSchema(database);

    const repository = new WatcherStateRepository(database);
    const run = repository.startRun("2026-06-04T15:00:00.000Z");

    expect(repository.getRun(run.id)).toEqual({
      id: run.id,
      startedAt: "2026-06-04T15:00:00.000Z",
      finishedAt: null,
      status: "running",
      productCount: 0,
      errorMessage: null,
    });
    expect(
      database.prepare("SELECT hash FROM __drizzle_migrations").get(),
    ).toBeDefined();
  });

  it("adopts an existing state schema when the migration table exists without the initial migration record", () => {
    const database = new Database(":memory:");
    createLegacyStateSchema(database);
    database.exec(`
      CREATE TABLE "__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at numeric
      );
    `);

    initializeStateSchema(database);

    const repository = new WatcherStateRepository(database);
    const run = repository.startRun("2026-06-04T15:00:00.000Z");

    expect(repository.getRun(run.id)).toEqual({
      id: run.id,
      startedAt: "2026-06-04T15:00:00.000Z",
      finishedAt: null,
      status: "running",
      productCount: 0,
      errorMessage: null,
    });
    expect(
      database.prepare("SELECT hash FROM __drizzle_migrations").get(),
    ).toBeDefined();
  });
});

describe("WatcherStateRepository products", () => {
  it("persists and reads normalized product snapshot state", () => {
    const database = new Database(":memory:");
    const repository = new WatcherStateRepository(database);

    repository.upsertProduct(PRODUCT_SNAPSHOT);

    expect(repository.getProduct("product-openai-tee")).toEqual(
      PRODUCT_SNAPSHOT,
    );
  });
});

describe("WatcherStateRepository events", () => {
  it("dedupes events by stable hash and persists notification state", () => {
    const database = new Database(":memory:");
    const repository = new WatcherStateRepository(database);

    const firstEvent = repository.recordEvent(BUYABLE_EVENT);
    const duplicateEvent = repository.recordEvent({
      eventHash: "public-openai-tee-fingerprint-1",
      eventType: "product_publicly_buyable",
      productId: null,
      payload: {
        ignored: true,
      },
      notificationStatus: "pending",
      attemptCount: 0,
      lastAttemptAt: null,
      notificationError: null,
      createdAt: "2026-06-04T15:06:00.000Z",
      notifiedAt: null,
    });

    expect(duplicateEvent.id).toBe(firstEvent.id);
    expect(
      repository.getEventByHash("public-openai-tee-fingerprint-1"),
    ).toEqual({
      id: firstEvent.id,
      ...BUYABLE_EVENT,
    });
  });
});

describe("WatcherStateRepository runs", () => {
  it("records run start and completion state", () => {
    const database = new Database(":memory:");
    const repository = new WatcherStateRepository(database);

    const run = repository.startRun("2026-06-04T15:00:00.000Z");
    repository.finishRun(run.id, {
      finishedAt: "2026-06-04T15:00:01.000Z",
      status: "completed",
      productCount: 0,
      errorMessage: null,
    });

    expect(repository.getRun(run.id)).toEqual({
      id: run.id,
      startedAt: "2026-06-04T15:00:00.000Z",
      finishedAt: "2026-06-04T15:00:01.000Z",
      status: "completed",
      productCount: 0,
      errorMessage: null,
    });
  });
});

describe("WatcherStateRepository product overrides", () => {
  it("persists simple product override flags and annotations", () => {
    const database = new Database(":memory:");
    const repository = new WatcherStateRepository(database);

    repository.setProductOverride(PRODUCT_OVERRIDE);

    expect(repository.getProductOverride("product-employee-hoodie")).toEqual(
      PRODUCT_OVERRIDE,
    );
  });
});

describe("openStateRepository", () => {
  it("creates parent directories and initializes a configured SQLite file", () => {
    const directory = mkdtempSync(join(tmpdir(), "supplywatch-state-"));
    const databasePath = join(directory, "nested", "supplywatch.sqlite");
    const state = openStateRepository(databasePath);

    try {
      const run = state.repository.startRun("2026-06-04T15:00:00.000Z");
      state.close();

      const reopened = openStateRepository(databasePath);
      try {
        expect(reopened.repository.getRun(run.id)).toEqual({
          id: run.id,
          startedAt: "2026-06-04T15:00:00.000Z",
          finishedAt: null,
          status: "running",
          productCount: 0,
          errorMessage: null,
        });
      } finally {
        reopened.close();
      }
    } finally {
      if (state.database.open) {
        state.close();
      }
      rmSync(directory, { force: true, recursive: true });
    }
  });
});

function createLegacyStateSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE products (
      stable_id TEXT PRIMARY KEY,
      name TEXT,
      url TEXT,
      image_url TEXT,
      description TEXT,
      collection TEXT,
      price TEXT,
      normalized_snapshot_json TEXT NOT NULL,
      raw_fingerprint TEXT,
      buyable_state TEXT NOT NULL,
      available_sizes_json TEXT NOT NULL DEFAULT '[]',
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      first_public_at TEXT,
      out_of_stock_confirmations INTEGER NOT NULL DEFAULT 0,
      retired_at TEXT,
      retirement_reason TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_hash TEXT NOT NULL UNIQUE,
      event_type TEXT NOT NULL,
      product_id TEXT REFERENCES products(stable_id) ON DELETE SET NULL,
      payload_json TEXT NOT NULL,
      notification_status TEXT NOT NULL DEFAULT 'pending',
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT,
      notification_error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      notified_at TEXT
    );

    CREATE INDEX events_notification_status_idx
      ON events(notification_status, attempt_count, created_at);

    CREATE TABLE runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL,
      product_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT
    );

    CREATE TABLE product_overrides (
      product_id TEXT PRIMARY KEY,
      denylisted INTEGER NOT NULL DEFAULT 0,
      force_retired INTEGER NOT NULL DEFAULT 0,
      force_watched INTEGER NOT NULL DEFAULT 0,
      known_employee_only INTEGER NOT NULL DEFAULT 0,
      annotation TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

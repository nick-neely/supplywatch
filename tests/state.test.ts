import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { openStateRepository } from "../src/state/database.js";
import { WatcherStateRepository } from "../src/state/repository.js";
import { initializeStateSchema } from "../src/state/schema.js";

describe("initializeStateSchema", () => {
  it("creates persistent watcher state tables with required columns", () => {
    const database = new Database(":memory:");

    initializeStateSchema(database);

    const columnsByTable = new Map<string, string[]>();
    for (const table of ["products", "events", "runs", "product_overrides"]) {
      const columns = database
        .prepare(`PRAGMA table_info(${table})`)
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
  });
});

describe("WatcherStateRepository products", () => {
  it("persists and reads normalized product snapshot state", () => {
    const database = new Database(":memory:");
    const repository = new WatcherStateRepository(database);

    repository.upsertProduct({
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
    });

    expect(repository.getProduct("product-openai-tee")).toEqual({
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
    });
  });
});

describe("WatcherStateRepository events", () => {
  it("dedupes events by stable hash and persists notification state", () => {
    const database = new Database(":memory:");
    const repository = new WatcherStateRepository(database);

    const firstEvent = repository.recordEvent({
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
    });
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

    repository.setProductOverride({
      productId: "product-employee-hoodie",
      denylisted: true,
      forceRetired: false,
      forceWatched: true,
      knownEmployeeOnly: true,
      annotation: "Employee-only product observed during fixture capture",
    });

    expect(repository.getProductOverride("product-employee-hoodie")).toEqual({
      productId: "product-employee-hoodie",
      denylisted: true,
      forceRetired: false,
      forceWatched: true,
      knownEmployeeOnly: true,
      annotation: "Employee-only product observed during fixture capture",
    });
  });
});

describe("openStateRepository", () => {
  it("creates parent directories and initializes a configured SQLite file", () => {
    const directory = mkdtempSync(join(tmpdir(), "supplywatch-state-"));
    const databasePath = join(directory, "nested", "supplywatch.sqlite");

    const state = openStateRepository(databasePath);
    const run = state.repository.startRun("2026-06-04T15:00:00.000Z");
    state.close();

    const reopened = openStateRepository(databasePath);
    expect(reopened.repository.getRun(run.id)).toEqual({
      id: run.id,
      startedAt: "2026-06-04T15:00:00.000Z",
      finishedAt: null,
      status: "running",
      productCount: 0,
      errorMessage: null,
    });
    reopened.close();
    rmSync(directory, { force: true, recursive: true });
  });
});

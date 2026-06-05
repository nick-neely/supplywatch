import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getDashboardEventDetail,
  listDashboardEvents,
  openReadOnlyStateDatabase,
  openStateRepository,
  type ProductRecord,
} from "@supplywatch/state";
import { describe, expect, it } from "vitest";

describe("watcher dashboard Events read model", () => {
  it("filters, sorts, and paginates persisted Events with related Product context", () => {
    const fixture = createEventsFixture();

    try {
      const readonly = openReadOnlyStateDatabase(fixture.databasePath);
      try {
        expect(
          listDashboardEvents(readonly.database, {
            eventType: "candidate_signal_detected",
            notificationStatus: "failed",
            productId: "tee-event",
            sortBy: "createdAt",
            sortDirection: "asc",
            page: 1,
            pageSize: 1,
          }),
        ).toEqual({
          events: [
            expect.objectContaining({
              id: fixture.failedCandidateEventId,
              eventType: "candidate_signal_detected",
              productId: "tee-event",
              productName: "OpenAI Logo Tee",
              notificationStatus: "failed",
              attemptCount: 2,
              createdAt: "2026-06-04T13:00:00.000Z",
              notifiedAt: null,
              hasPayload: true,
              hasNotificationError: true,
            }),
          ],
          pagination: {
            page: 1,
            pageSize: 1,
            totalItems: 2,
            totalPages: 2,
          },
        });
      } finally {
        readonly.close();
      }
    } finally {
      fixture.cleanup();
    }
  });

  it("returns Event detail and missing Event state by stable Event ID", () => {
    const fixture = createEventsFixture();

    try {
      const readonly = openReadOnlyStateDatabase(fixture.databasePath);
      try {
        expect(
          getDashboardEventDetail(
            readonly.database,
            fixture.failedCandidateEventId,
          ),
        ).toEqual(
          expect.objectContaining({
            id: fixture.failedCandidateEventId,
            eventType: "candidate_signal_detected",
            productId: "tee-event",
            productName: "OpenAI Logo Tee",
            payload: { signal: "animate-wiggle", evidenceOnly: true },
            notificationStatus: "failed",
            attemptCount: 2,
            notificationError: "Discord webhook failed",
            hasPayload: true,
            hasNotificationError: true,
          }),
        );
        expect(getDashboardEventDetail(readonly.database, 404)).toBeNull();
      } finally {
        readonly.close();
      }
    } finally {
      fixture.cleanup();
    }
  });
});

function createEventsFixture(): {
  databasePath: string;
  failedCandidateEventId: number;
  cleanup: () => void;
} {
  const directory = mkdtempSync(join(tmpdir(), "supplywatch-events-"));
  const databasePath = join(directory, "supplywatch.sqlite");
  const state = openStateRepository(databasePath);

  try {
    state.repository.upsertProduct(
      product({
        stableId: "tee-event",
        name: "OpenAI Logo Tee",
      }),
    );
    const failedCandidateEventId = state.repository.recordEvent({
      eventHash: "candidate-old",
      eventType: "candidate_signal_detected",
      productId: "tee-event",
      payload: { signal: "animate-wiggle", evidenceOnly: true },
      notificationStatus: "failed",
      attemptCount: 2,
      lastAttemptAt: "2026-06-04T13:01:00.000Z",
      notificationError: "Discord webhook failed",
      createdAt: "2026-06-04T13:00:00.000Z",
      notifiedAt: null,
    }).id;
    state.repository.recordEvent({
      eventHash: "candidate-new",
      eventType: "candidate_signal_detected",
      productId: "tee-event",
      payload: { signal: "animate-wiggle", evidenceOnly: true },
      notificationStatus: "failed",
      attemptCount: 3,
      lastAttemptAt: "2026-06-04T14:01:00.000Z",
      notificationError: "Discord webhook still failed",
      createdAt: "2026-06-04T14:00:00.000Z",
      notifiedAt: null,
    });
    state.repository.recordEvent({
      eventHash: "sent-public",
      eventType: "product_publicly_buyable",
      productId: "tee-event",
      payload: { source: "detail" },
      notificationStatus: "sent",
      attemptCount: 1,
      lastAttemptAt: "2026-06-04T15:01:00.000Z",
      notificationError: null,
      createdAt: "2026-06-04T15:00:00.000Z",
      notifiedAt: "2026-06-04T15:01:05.000Z",
    });

    return {
      databasePath,
      failedCandidateEventId,
      cleanup: () => rmSync(directory, { force: true, recursive: true }),
    };
  } finally {
    state.close();
  }
}

function product(overrides: Partial<ProductRecord>): ProductRecord {
  return {
    stableId: "product",
    name: "Product",
    url: "https://example.com/products/product",
    imageUrl: null,
    description: "A persisted product.",
    collection: "Apparel",
    price: "$42",
    normalizedSnapshot: { stableId: "product", variants: [] },
    rawFingerprint: null,
    buyableState: "unknown",
    availableSizes: [],
    firstSeenAt: "2026-06-04T12:00:00.000Z",
    lastSeenAt: "2026-06-04T12:00:00.000Z",
    firstPublicAt: null,
    outOfStockConfirmations: 0,
    retiredAt: null,
    retirementReason: null,
    ...overrides,
  };
}

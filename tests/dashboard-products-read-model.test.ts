import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getDashboardProductDetail,
  getDashboardProducts,
  openReadOnlyStateDatabase,
  openStateRepository,
  type ProductRecord,
} from "@supplywatch/state";
import { describe, expect, it } from "vitest";

describe("dashboard Products read model", () => {
  it("lists persisted Products with server-side filters, sorting, pagination, and override badges", () => {
    const directory = mkdtempSync(join(tmpdir(), "supplywatch-products-"));
    const databasePath = join(directory, "supplywatch.sqlite");
    const state = openStateRepository(databasePath);

    try {
      state.repository.upsertProduct(
        product({
          stableId: "tee-active",
          name: "OpenAI Logo Tee",
          collection: "Apparel",
          buyableState: "publicly_buyable",
          availableSizes: ["M", "L"],
          lastSeenAt: "2026-06-04T15:00:00.000Z",
        }),
      );
      state.repository.upsertProduct(
        product({
          stableId: "hat-active",
          name: "Embroidered Hat",
          collection: "Accessories",
          buyableState: "out_of_stock",
          availableSizes: [],
          lastSeenAt: "2026-06-04T16:00:00.000Z",
        }),
      );
      state.repository.upsertProduct(
        product({
          stableId: "hoodie-retired",
          name: "Retired Hoodie",
          collection: "Apparel",
          buyableState: "employee_only",
          availableSizes: ["S"],
          retiredAt: "2026-06-04T13:00:00.000Z",
          lastSeenAt: "2026-06-04T13:00:00.000Z",
        }),
      );
      state.repository.setProductOverride({
        productId: "tee-active",
        denylisted: true,
        forceRetired: false,
        forceWatched: true,
        knownEmployeeOnly: false,
        annotation: "manual watch context",
      });
    } finally {
      state.close();
    }

    const readonly = openReadOnlyStateDatabase(databasePath);
    try {
      const page = getDashboardProducts(readonly.database, {
        search: "openai",
        availabilityStates: ["publicly_buyable"],
        watchStatus: "active",
        collection: "Apparel",
        notificationRelevant: true,
        sort: { field: "lastSeenAt", direction: "desc" },
        page: 1,
        pageSize: 10,
      });

      expect(page).toMatchObject({
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      });
      expect(page.products).toEqual([
        expect.objectContaining({
          stableId: "tee-active",
          name: "OpenAI Logo Tee",
          collection: "Apparel",
          price: "$42",
          availabilityState: "publicly_buyable",
          availableSizes: ["M", "L"],
          isRetired: false,
          overrideBadges: ["denylisted", "force watched"],
        }),
      ]);
    } finally {
      readonly.close();
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("returns stable Product detail with overrides, recent Events, and raw evidence", () => {
    const directory = mkdtempSync(join(tmpdir(), "supplywatch-product-"));
    const databasePath = join(directory, "supplywatch.sqlite");
    const state = openStateRepository(databasePath);

    try {
      state.repository.upsertProduct(
        product({
          stableId: "tee-detail",
          name: "OpenAI Logo Tee",
          normalizedSnapshot: {
            title: "OpenAI Logo Tee",
            variants: [{ size: "M", available: true }],
          },
          rawFingerprint: "fingerprint:tee-detail",
          buyableState: "publicly_buyable",
          availableSizes: ["M"],
          firstPublicAt: "2026-06-04T14:00:00.000Z",
          outOfStockConfirmations: 0,
        }),
      );
      state.repository.setProductOverride({
        productId: "tee-detail",
        denylisted: false,
        forceRetired: false,
        forceWatched: true,
        knownEmployeeOnly: true,
        annotation: "operator knows staff gate context",
      });
      state.repository.recordEvent({
        eventHash: "tee-detail-public",
        eventType: "product_publicly_buyable",
        productId: "tee-detail",
        payload: { alertKind: "product", source: "detail" },
        notificationStatus: "sent",
        attemptCount: 1,
        lastAttemptAt: "2026-06-04T14:01:00.000Z",
        notificationError: null,
        createdAt: "2026-06-04T14:00:30.000Z",
        notifiedAt: "2026-06-04T14:01:10.000Z",
      });
    } finally {
      state.close();
    }

    const readonly = openReadOnlyStateDatabase(databasePath);
    try {
      expect(
        getDashboardProductDetail(readonly.database, "missing"),
      ).toBeNull();
      expect(
        getDashboardProductDetail(readonly.database, "tee-detail"),
      ).toEqual(
        expect.objectContaining({
          stableId: "tee-detail",
          name: "OpenAI Logo Tee",
          sourceUrl: "https://example.com/products/product",
          availabilityState: "publicly_buyable",
          availableSizes: ["M"],
          firstPublicAt: "2026-06-04T14:00:00.000Z",
          rawFingerprint: "fingerprint:tee-detail",
          override: {
            productId: "tee-detail",
            denylisted: false,
            forceRetired: false,
            forceWatched: true,
            knownEmployeeOnly: true,
            annotation: "operator knows staff gate context",
          },
          overrideBadges: ["force watched", "known employee only"],
          recentEvents: [
            expect.objectContaining({
              eventType: "product_publicly_buyable",
              notificationStatus: "sent",
              attemptCount: 1,
            }),
          ],
        }),
      );
    } finally {
      readonly.close();
      rmSync(directory, { force: true, recursive: true });
    }
  });
});

function product(overrides: Partial<ProductRecord>): ProductRecord {
  return {
    stableId: "product",
    name: "Product",
    url: "https://example.com/products/product",
    imageUrl: "https://example.com/product.png",
    description: "A persisted product.",
    collection: "Apparel",
    price: "$42",
    normalizedSnapshot: { stableId: "product", variants: [] },
    rawFingerprint: "fingerprint",
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

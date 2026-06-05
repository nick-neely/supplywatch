import { type ProductRecord, WatcherStateRepository } from "@supplywatch/state";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import type { DetailInspectionResult } from "../src/detail/inspection.js";
import type { DiscoveredProduct } from "../src/discovery/products.js";
import {
  diffProductSnapshot,
  shouldInspectProductSnapshot,
} from "../src/state/diff.js";

const OBSERVED_AT = "2026-06-04T15:00:00.000Z";
const LATER = "2026-06-04T15:05:00.000Z";

const PRODUCT: DiscoveredProduct = {
  stableId: "url-products-public-drop-tee",
  name: "Public Drop Tee",
  url: "https://supplyco.openai.com/products/public-drop-tee",
  imageUrl: "https://cdn.example/public-drop-tee.png",
  description: "Soft launch shirt",
  collection: "Apparel",
  price: "$28",
  candidateEvidence: [],
  normalizedSnapshot: {
    stableId: "url-products-public-drop-tee",
    name: "Public Drop Tee",
    url: "https://supplyco.openai.com/products/public-drop-tee",
    imageUrl: "https://cdn.example/public-drop-tee.png",
    description: "Soft launch shirt",
    collection: "Apparel",
    price: "$28",
    candidateSignals: [],
    cardEvidence: [],
    observedAt: OBSERVED_AT,
  },
  rawFingerprint: "card-fingerprint-1",
};

const BUYABLE_INSPECTION: DetailInspectionResult = {
  stableId: PRODUCT.stableId,
  productUrl: PRODUCT.url,
  description: PRODUCT.description,
  buyable: true,
  confidence: "high",
  availableSizes: ["M"],
  disabledSizes: ["S"],
  actionEvidence: [
    {
      label: "Add to cart",
      disabled: false,
      href: null,
    },
  ],
  detailText: "Public Drop Tee M Add to cart",
  evidence: [
    {
      kind: "purchase-control",
      message:
        "Enabled public purchase control is visible on the product detail state.",
      value: "Add to cart",
    },
  ],
  detectors: [],
  verificationBoundary:
    "May verify public Shopify/cart intent only; must not automate checkout, submit private information, bypass authentication, or complete purchases.",
};

const OUT_OF_STOCK_INSPECTION: DetailInspectionResult = {
  ...BUYABLE_INSPECTION,
  buyable: false,
  availableSizes: [],
  disabledSizes: [],
  actionEvidence: [
    {
      label: "Out of stock",
      disabled: true,
      href: null,
    },
  ],
  detailText: "Public Drop Tee Out of stock",
  evidence: [
    {
      kind: "unavailable-text",
      message: "Product detail state says out of stock.",
      value: "Out of stock",
    },
  ],
  detectors: [
    {
      name: "unavailable-text",
      matched: true,
      confidence: "high",
      polarity: "negative",
      evidence: [],
    },
  ],
};

function repository(): WatcherStateRepository {
  return new WatcherStateRepository(new Database(":memory:"));
}

function existingProduct(
  overrides: Partial<ProductRecord> = {},
): ProductRecord {
  return {
    stableId: PRODUCT.stableId,
    name: PRODUCT.name,
    url: PRODUCT.url,
    imageUrl: PRODUCT.imageUrl,
    description: PRODUCT.description,
    collection: PRODUCT.collection,
    price: PRODUCT.price,
    normalizedSnapshot: PRODUCT.normalizedSnapshot,
    rawFingerprint: PRODUCT.rawFingerprint,
    buyableState: "out_of_stock",
    availableSizes: [],
    firstSeenAt: OBSERVED_AT,
    lastSeenAt: OBSERVED_AT,
    firstPublicAt: null,
    outOfStockConfirmations: 1,
    retiredAt: null,
    retirementReason: null,
    ...overrides,
  };
}

describe("diffProductSnapshot", () => {
  it("creates a deduped public purchase availability event for a new buyable product", () => {
    const state = repository();

    const result = diffProductSnapshot(state, {
      product: PRODUCT,
      inspection: BUYABLE_INSPECTION,
      observedAt: OBSERVED_AT,
    });
    const duplicate = diffProductSnapshot(state, {
      product: PRODUCT,
      inspection: BUYABLE_INSPECTION,
      observedAt: LATER,
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      eventType: "public_purchase_available",
      productId: PRODUCT.stableId,
      notificationStatus: "pending",
      payload: expect.objectContaining({
        transition: "new_public_purchase_available",
        productName: "Public Drop Tee",
        availableSizes: ["M"],
      }),
    });
    expect(duplicate.events[0]?.id).toBe(result.events[0]?.id);
    expect(state.getProduct(PRODUCT.stableId)).toMatchObject({
      buyableState: "publicly_buyable",
      firstPublicAt: OBSERVED_AT,
      outOfStockConfirmations: 0,
      retiredAt: null,
    });
  });

  it("persists detail description when the card does not expose product copy", () => {
    const state = repository();

    diffProductSnapshot(state, {
      product: {
        ...PRODUCT,
        description: null,
        normalizedSnapshot: {
          ...PRODUCT.normalizedSnapshot,
          description: null,
        },
      },
      inspection: {
        ...OUT_OF_STOCK_INSPECTION,
        description:
          "Never talk about goblins. But get this goblin crewneck while supplies last. 100% cotton.",
      },
      observedAt: OBSERVED_AT,
    });

    expect(state.getProduct(PRODUCT.stableId)).toMatchObject({
      description:
        "Never talk about goblins. But get this goblin crewneck while supplies last. 100% cotton.",
      buyableState: "out_of_stock",
    });
  });

  it("classifies archived detail states as employee-only instead of unknown", () => {
    const state = repository();

    diffProductSnapshot(state, {
      product: PRODUCT,
      inspection: {
        ...OUT_OF_STOCK_INSPECTION,
        description: "Released Feb 2026 [Archived]",
        detailText: "Codex Cap Released Feb 2026 [Archived]",
        actionEvidence: [],
        evidence: [
          {
            kind: "archived-copy",
            message: "Product detail state is marked archived.",
            value: "Archived",
          },
        ],
        detectors: [
          {
            name: "archived",
            matched: true,
            confidence: "high",
            polarity: "negative",
            evidence: [],
          },
        ],
      },
      observedAt: OBSERVED_AT,
    });

    expect(state.getProduct(PRODUCT.stableId)).toMatchObject({
      buyableState: "employee_only",
      outOfStockConfirmations: 0,
    });
  });

  it("creates transition, newly available size, and likely restock events for meaningful availability changes", () => {
    const state = repository();
    state.upsertProduct(existingProduct({ availableSizes: ["S"] }));

    const result = diffProductSnapshot(state, {
      product: PRODUCT,
      inspection: {
        ...BUYABLE_INSPECTION,
        availableSizes: ["S", "M"],
      },
      observedAt: LATER,
    });

    expect(result.events.map((event) => event.eventType)).toEqual([
      "public_purchase_available",
      "newly_available_size",
      "likely_restock",
    ]);
    expect(result.events[0]?.payload).toEqual(
      expect.objectContaining({
        transition: "became_publicly_buyable",
      }),
    );
    expect(result.events[1]?.payload).toEqual(
      expect.objectContaining({
        newlyAvailableSizes: ["M"],
      }),
    );
    expect(result.events[2]?.payload).toEqual(
      expect.objectContaining({
        previousBuyableState: "out_of_stock",
        currentBuyableState: "publicly_buyable",
      }),
    );
  });

  it("reports newly available sizes without a duplicate general availability event for an already public product", () => {
    const state = repository();
    state.upsertProduct(
      existingProduct({
        buyableState: "publicly_buyable",
        availableSizes: ["S"],
        firstPublicAt: OBSERVED_AT,
        outOfStockConfirmations: 0,
      }),
    );

    const result = diffProductSnapshot(state, {
      product: {
        ...PRODUCT,
        rawFingerprint: "card-fingerprint-size-change",
      },
      inspection: {
        ...BUYABLE_INSPECTION,
        availableSizes: ["S", "M"],
      },
      observedAt: LATER,
    });

    expect(result.events.map((event) => event.eventType)).toEqual([
      "newly_available_size",
    ]);
  });

  it("stores candidate and out-of-stock evidence without merch notification events and retires after three confirmations", () => {
    const state = repository();
    state.upsertProduct(
      existingProduct({
        outOfStockConfirmations: 2,
      }),
    );
    const candidateProduct = {
      ...PRODUCT,
      candidateEvidence: [
        {
          signal: "animate-wiggle",
          source: "class" as const,
          value: "animate-wiggle",
        },
      ],
      normalizedSnapshot: {
        ...PRODUCT.normalizedSnapshot,
        candidateSignals: ["animate-wiggle"],
      },
      rawFingerprint: "card-fingerprint-wiggle",
    };

    const result = diffProductSnapshot(state, {
      product: candidateProduct,
      inspection: OUT_OF_STOCK_INSPECTION,
      observedAt: LATER,
    });

    expect(result.events.map((event) => event.eventType)).toEqual([
      "candidate_signal_observed",
      "out_of_stock_confirmed",
      "product_retired",
    ]);
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          notificationStatus: "dry_run",
        }),
      ]),
    );
    expect(state.getProduct(PRODUCT.stableId)).toMatchObject({
      buyableState: "out_of_stock",
      outOfStockConfirmations: 3,
      retiredAt: LATER,
      retirementReason: "three_out_of_stock_confirmations",
    });
  });

  it("keeps retired products on card observation and unretires them when a strong card signal changes", () => {
    const state = repository();
    const retiredProduct = existingProduct({
      outOfStockConfirmations: 3,
      retiredAt: OBSERVED_AT,
      retirementReason: "three_out_of_stock_confirmations",
    });
    state.upsertProduct(retiredProduct);
    const changedProduct = {
      ...PRODUCT,
      candidateEvidence: [
        {
          signal: "animate-wiggle",
          source: "class" as const,
          value: "animate-wiggle",
        },
      ],
      normalizedSnapshot: {
        ...PRODUCT.normalizedSnapshot,
        candidateSignals: ["animate-wiggle"],
      },
      rawFingerprint: "card-fingerprint-strong-change",
    };

    expect(
      shouldInspectProductSnapshot({
        product: changedProduct,
        existing: retiredProduct,
        override: null,
      }),
    ).toBe(true);

    const result = diffProductSnapshot(state, {
      product: changedProduct,
      inspection: null,
      observedAt: LATER,
    });

    expect(result.events.map((event) => event.eventType)).toContain(
      "product_unretired",
    );
    expect(state.getProduct(PRODUCT.stableId)).toMatchObject({
      retiredAt: null,
      retirementReason: null,
    });
  });

  it("applies denylist, force-retire, force-watch, and known employee-only overrides during diff decisions", () => {
    const state = repository();
    state.upsertProduct(
      existingProduct({
        retiredAt: OBSERVED_AT,
        retirementReason: "three_out_of_stock_confirmations",
      }),
    );
    state.setProductOverride({
      productId: PRODUCT.stableId,
      denylisted: true,
      forceRetired: true,
      forceWatched: true,
      knownEmployeeOnly: true,
      annotation: "Known internal merch",
    });

    expect(
      shouldInspectProductSnapshot({
        product: PRODUCT,
        existing: state.getProduct(PRODUCT.stableId),
        override: state.getProductOverride(PRODUCT.stableId),
      }),
    ).toBe(true);

    const result = diffProductSnapshot(state, {
      product: PRODUCT,
      inspection: BUYABLE_INSPECTION,
      observedAt: LATER,
    });

    expect(result.events.map((event) => event.eventType)).toEqual([
      "override_applied",
    ]);
    expect(result.events[0]?.notificationStatus).toBe("dry_run");
    expect(state.getProduct(PRODUCT.stableId)).toMatchObject({
      buyableState: "employee_only",
      retiredAt: LATER,
      retirementReason: "override:force_retired",
      firstPublicAt: null,
    });
  });
});

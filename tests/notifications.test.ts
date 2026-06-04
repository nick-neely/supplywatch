import Database from "better-sqlite3";
import { describe, expect, it, vi } from "vitest";
import {
  dispatchPendingNotifications,
  renderDiscordWebhookPayload,
} from "../src/notifications/discord.js";
import type { EventRecord, ProductRecord } from "../src/state/repository.js";
import { WatcherStateRepository } from "../src/state/repository.js";

const CREATED_AT = "2026-06-04T15:00:00.000Z";
const NOW = "2026-06-04T15:05:00.000Z";

const MERCH_EVENT: EventRecord = {
  eventHash: "public-drop-tee-alert",
  eventType: "public_purchase_available",
  productId: "url-products-public-drop-tee",
  payload: {
    alertKind: "merch",
    productId: "url-products-public-drop-tee",
    observedAt: CREATED_AT,
    productName: "Public Drop Tee",
    productUrl: "https://supplyco.openai.com/products/public-drop-tee",
    imageUrl: "https://cdn.example/public-drop-tee.png",
    description: "Soft launch shirt",
    price: "$28",
    availableSizes: ["M", "L"],
    confidence: "high",
    evidence: [
      {
        kind: "purchase-control",
        message:
          "Enabled public purchase control is visible on the product detail state.",
        value: "Add to cart",
      },
    ],
    actionEvidence: [
      {
        label: "Add to cart",
        disabled: false,
        href: null,
      },
    ],
    detectors: [
      {
        name: "purchase-control",
        matched: true,
        confidence: "high",
      },
    ],
  },
  notificationStatus: "pending",
  attemptCount: 0,
  lastAttemptAt: null,
  notificationError: null,
  createdAt: CREATED_AT,
  notifiedAt: null,
};

const CANDIDATE_EVENT: EventRecord = {
  ...MERCH_EVENT,
  eventHash: "candidate-signal",
  eventType: "candidate_signal_observed",
  payload: {
    alertKind: "state_evidence",
    productId: "url-products-public-drop-tee",
    observedAt: CREATED_AT,
    productName: "Public Drop Tee",
    candidateEvidence: [
      {
        signal: "animate-wiggle",
        source: "class",
        value: "animate-wiggle",
      },
    ],
  },
};

const HEALTH_EVENT: EventRecord = {
  ...MERCH_EVENT,
  eventHash: "zero-product-run",
  eventType: "health_zero_product_run",
  productId: null,
  payload: {
    alertKind: "health",
    observedAt: CREATED_AT,
    title: "Supplywatch zero-product run",
    description: "Rendered page returned no products.",
    scope: "discovery",
  },
};

const PRODUCT: ProductRecord = {
  stableId: "url-products-public-drop-tee",
  name: "Public Drop Tee",
  url: "https://supplyco.openai.com/products/public-drop-tee",
  imageUrl: "https://cdn.example/public-drop-tee.png",
  description: "Soft launch shirt",
  collection: "Apparel",
  price: "$28",
  normalizedSnapshot: {
    stableId: "url-products-public-drop-tee",
    buyable: true,
  },
  rawFingerprint: "fingerprint-1",
  buyableState: "publicly_buyable",
  availableSizes: ["M", "L"],
  firstSeenAt: CREATED_AT,
  lastSeenAt: CREATED_AT,
  firstPublicAt: CREATED_AT,
  outOfStockConfirmations: 0,
  retiredAt: null,
  retirementReason: null,
};

function repository(): WatcherStateRepository {
  const state = new WatcherStateRepository(new Database(":memory:"));
  state.upsertProduct(PRODUCT);
  return state;
}

describe("renderDiscordWebhookPayload", () => {
  it("renders a rich merch alert embed from confirmed availability event payload", () => {
    const state = repository();
    const event = state.recordEvent(MERCH_EVENT);

    expect(renderDiscordWebhookPayload(event)).toEqual({
      content: null,
      embeds: [
        expect.objectContaining({
          title: "Public Drop Tee",
          url: "https://supplyco.openai.com/products/public-drop-tee",
          description: "Soft launch shirt",
          color: expect.any(Number),
          timestamp: CREATED_AT,
          image: {
            url: "https://cdn.example/public-drop-tee.png",
          },
          fields: expect.arrayContaining([
            { name: "Price", value: "$28", inline: true },
            { name: "Available sizes", value: "M, L", inline: true },
            { name: "Confidence", value: "high", inline: true },
            {
              name: "Action evidence",
              value: "Add to cart",
              inline: false,
            },
            {
              name: "Detector evidence",
              value: "purchase-control: matched (high)",
              inline: false,
            },
            {
              name: "Evidence",
              value:
                "purchase-control: Enabled public purchase control is visible on the product detail state. (Add to cart)",
              inline: false,
            },
          ]),
        }),
      ],
    });
  });

  it("renders health alerts distinctly from merch alerts", () => {
    const state = repository();
    const event = state.recordEvent(HEALTH_EVENT);

    expect(renderDiscordWebhookPayload(event).embeds[0]).toEqual(
      expect.objectContaining({
        title: "Supplywatch zero-product run",
        description: "Rendered page returned no products.",
        footer: {
          text: "supplywatch health alert • rate-limit eligible",
        },
        fields: expect.arrayContaining([
          { name: "Event", value: "health_zero_product_run", inline: true },
          { name: "Scope", value: "discovery", inline: true },
        ]),
      }),
    );
  });
});

describe("dispatchPendingNotifications", () => {
  it("previews dry-run merch alerts without consuming pending notification state", async () => {
    const state = repository();
    const event = state.recordEvent(MERCH_EVENT);
    const send = vi.fn();
    const log = vi.fn();

    const result = await dispatchPendingNotifications(state, {
      dryRun: true,
      webhookUrl: undefined,
      now: NOW,
      maxAttempts: 10,
      send,
      log,
    });

    expect(result).toEqual({
      dryRun: 1,
      failed: 0,
      sent: 0,
      skipped: 0,
    });
    expect(send).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('"title":"Public Drop Tee"'),
    );
    expect(state.getEventByHash(event.eventHash)).toEqual(
      expect.objectContaining({
        notificationStatus: "pending",
        attemptCount: 0,
        lastAttemptAt: null,
        notificationError: null,
        notifiedAt: null,
      }),
    );
  });

  it("sends legacy dry-run merch alerts when Discord is later enabled", async () => {
    const state = repository();
    const event = state.recordEvent({
      ...MERCH_EVENT,
      notificationStatus: "dry_run",
      notifiedAt: NOW,
    });
    const send = vi.fn().mockResolvedValue(undefined);

    const result = await dispatchPendingNotifications(state, {
      dryRun: false,
      webhookUrl: "https://discord.com/api/webhooks/example",
      now: "2026-06-04T15:10:00.000Z",
      maxAttempts: 10,
      send,
    });

    expect(result.sent).toBe(1);
    expect(send).toHaveBeenCalledOnce();
    expect(state.getEventByHash(event.eventHash)).toEqual(
      expect.objectContaining({
        notificationStatus: "sent",
        notifiedAt: "2026-06-04T15:10:00.000Z",
      }),
    );
  });

  it("sends pending merch alerts and records successful notification state", async () => {
    const state = repository();
    const event = state.recordEvent(MERCH_EVENT);
    const send = vi.fn().mockResolvedValue(undefined);

    const result = await dispatchPendingNotifications(state, {
      dryRun: false,
      webhookUrl: "https://discord.com/api/webhooks/example",
      now: NOW,
      maxAttempts: 10,
      send,
    });

    expect(result).toEqual({
      dryRun: 0,
      failed: 0,
      sent: 1,
      skipped: 0,
    });
    expect(send).toHaveBeenCalledWith(
      "https://discord.com/api/webhooks/example",
      expect.objectContaining({
        embeds: [expect.objectContaining({ title: "Public Drop Tee" })],
      }),
    );
    expect(state.getEventByHash(event.eventHash)).toEqual(
      expect.objectContaining({
        notificationStatus: "sent",
        attemptCount: 0,
        notificationError: null,
        notifiedAt: NOW,
      }),
    );
  });

  it("keeps transient Discord failures pending with retry state", async () => {
    const state = repository();
    const event = state.recordEvent({
      ...MERCH_EVENT,
      attemptCount: 2,
      lastAttemptAt: "2026-06-04T15:01:00.000Z",
      notificationError: "previous timeout",
    });
    const send = vi.fn().mockRejectedValue(new Error("webhook timeout"));

    const result = await dispatchPendingNotifications(state, {
      dryRun: false,
      webhookUrl: "https://discord.com/api/webhooks/example",
      now: NOW,
      maxAttempts: 10,
      send,
    });

    expect(result).toEqual({
      dryRun: 0,
      failed: 0,
      sent: 0,
      skipped: 0,
    });
    expect(state.getEventByHash(event.eventHash)).toEqual(
      expect.objectContaining({
        notificationStatus: "pending",
        attemptCount: 3,
        lastAttemptAt: NOW,
        notificationError: "webhook timeout",
        notifiedAt: null,
      }),
    );
  });

  it("marks Discord notifications failed at the retry attempt cap", async () => {
    const state = repository();
    const event = state.recordEvent({
      ...MERCH_EVENT,
      attemptCount: 9,
      lastAttemptAt: "2026-06-04T15:01:00.000Z",
    });
    const send = vi.fn().mockRejectedValue(new Error("webhook still down"));

    const result = await dispatchPendingNotifications(state, {
      dryRun: false,
      webhookUrl: "https://discord.com/api/webhooks/example",
      now: NOW,
      maxAttempts: 10,
      send,
    });

    expect(result.failed).toBe(1);
    expect(state.getEventByHash(event.eventHash)).toEqual(
      expect.objectContaining({
        notificationStatus: "failed",
        attemptCount: 10,
        lastAttemptAt: NOW,
        notificationError: "webhook still down",
        notifiedAt: null,
      }),
    );
  });

  it("marks stale pending notifications failed after the retry window", async () => {
    const state = repository();
    const event = state.recordEvent({
      ...MERCH_EVENT,
      createdAt: "2026-06-03T14:00:00.000Z",
      attemptCount: 4,
    });
    const send = vi.fn();

    const result = await dispatchPendingNotifications(state, {
      dryRun: false,
      webhookUrl: "https://discord.com/api/webhooks/example",
      now: NOW,
      maxAttempts: 10,
      retryWindowMs: 24 * 60 * 60 * 1000,
      send,
    });

    expect(result.failed).toBe(1);
    expect(send).not.toHaveBeenCalled();
    expect(state.getEventByHash(event.eventHash)).toEqual(
      expect.objectContaining({
        notificationStatus: "failed",
        attemptCount: 4,
        lastAttemptAt: NOW,
        notificationError:
          "Notification retry window expired after roughly 24 hours",
      }),
    );
  });

  it("does not send candidate signal evidence as Discord alerts", async () => {
    const state = repository();
    const event = state.recordEvent(CANDIDATE_EVENT);
    const send = vi.fn();

    const result = await dispatchPendingNotifications(state, {
      dryRun: false,
      webhookUrl: "https://discord.com/api/webhooks/example",
      now: NOW,
      maxAttempts: 10,
      send,
    });

    expect(result.skipped).toBe(1);
    expect(send).not.toHaveBeenCalled();
    expect(state.getEventByHash(event.eventHash)).toEqual(
      expect.objectContaining({
        notificationStatus: "pending",
        notifiedAt: null,
      }),
    );
  });
});

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStateRepository } from "@supplywatch/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../src/cli.js";
import type { DetailInspectionResult } from "../src/detail/inspection.js";
import type { DiscoveredProduct } from "../src/discovery/products.js";

const DISCOVERED_PRODUCT: DiscoveredProduct = {
  stableId: "url-products-public-drop-tee",
  name: "Public Drop Tee",
  url: "https://supplyco.openai.com/products/public-drop-tee",
  imageUrl: "https://cdn.example/public-drop-tee.png",
  description: "Soft launch shirt",
  collection: "Apparel",
  price: "$28",
  candidateEvidence: [
    {
      signal: "animate-wiggle",
      source: "class",
      value: "group animate-wiggle",
    },
  ],
  normalizedSnapshot: {
    stableId: "url-products-public-drop-tee",
    name: "Public Drop Tee",
    url: "https://supplyco.openai.com/products/public-drop-tee",
    imageUrl: "https://cdn.example/public-drop-tee.png",
    description: "Soft launch shirt",
    collection: "Apparel",
    price: "$28",
    candidateSignals: ["animate-wiggle"],
    cardEvidence: [
      {
        signal: "animate-wiggle",
        source: "class",
        value: "group animate-wiggle",
      },
    ],
    observedAt: "2026-06-04T15:00:00.000Z",
  },
  rawFingerprint: "fingerprint-card-1",
};

const PUBLIC_DETAIL_INSPECTION: DetailInspectionResult = {
  stableId: "url-products-public-drop-tee",
  productUrl: "https://supplyco.openai.com/products/public-drop-tee",
  description: "Soft launch shirt",
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

describe("runCli", () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { force: true, recursive: true });
      tempDir = undefined;
    }
  });

  it("exposes a capture-fixture command", async () => {
    const capture = vi.fn().mockResolvedValue({
      directory: "fixtures/product-states/sizeless/public-drop-tee",
      htmlPath: "fixtures/product-states/sizeless/public-drop-tee/detail.html",
      metadataPath:
        "fixtures/product-states/sizeless/public-drop-tee/metadata.json",
    });
    const log = vi.fn();

    await runCli(
      [
        "capture-fixture",
        "--url",
        "https://supplyco.openai.com/products/public-drop-tee",
        "--state",
        "sizeless",
        "--name",
        "public-drop-tee",
        "--output",
        "fixtures",
      ],
      { capture, log },
    );

    expect(capture).toHaveBeenCalledWith({
      url: "https://supplyco.openai.com/products/public-drop-tee",
      state: "sizeless",
      name: "public-drop-tee",
      outputDir: "fixtures",
    });
    expect(log).toHaveBeenCalledWith(
      "captured fixture: fixtures/product-states/sizeless/public-drop-tee",
    );
  });

  it("prints a dry-run detail inspection summary and persists classified observations", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "supplywatch-cli-"));
    const databasePath = join(tempDir, "supplywatch.sqlite");
    const poll = vi.fn().mockResolvedValue({
      products: [DISCOVERED_PRODUCT],
      observedWindowMs: 15_000,
    });
    const log = vi.fn();
    const inspect = vi.fn().mockResolvedValue(PUBLIC_DETAIL_INSPECTION);
    const saveDebugArtifact = vi.fn().mockResolvedValue(undefined);

    await runCli(["poll-once"], {
      loadConfig: () => ({
        SUPPLYWATCH_TARGET_URL: "https://supplyco.openai.com",
        DATABASE_PATH: databasePath,
        DRY_RUN: true,
        DISCORD_WEBHOOK_URL: undefined,
        POLL_INTERVAL_SECONDS: 60,
        OBSERVATION_WINDOW_SECONDS: 15,
        FULL_SWEEP_INTERVAL_MINUTES: 60,
        OUT_OF_STOCK_RETIRE_CONFIRMATIONS: 3,
        NOTIFY_MAX_ATTEMPTS: 10,
      }),
      log,
      poll,
      inspect,
      saveDebugArtifact,
    });

    expect(poll).toHaveBeenCalledWith({
      targetUrl: "https://supplyco.openai.com",
      observationWindowMs: 15_000,
      fullSweep: false,
    });
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("products found: 1"),
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("candidate signals: animate-wiggle"),
    );
    expect(log).toHaveBeenCalledWith(expect.stringContaining("inspected: 1"));
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("confirmed public availability: 1"),
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("detail checks skipped: 0"),
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("events recorded: 2"),
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("would-notify events: 1"),
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("Discord sends: 0"),
    );
    expect(saveDebugArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        directory: join(tempDir, "debug-artifacts"),
        reason: "confirmed-availability",
        product: DISCOVERED_PRODUCT,
        inspection: PUBLIC_DETAIL_INSPECTION,
        errorMessage: null,
      }),
    );

    const state = openStateRepository(databasePath);
    try {
      expect(
        state.repository.getProduct("url-products-public-drop-tee"),
      ).toEqual(
        expect.objectContaining({
          stableId: "url-products-public-drop-tee",
          buyableState: "publicly_buyable",
          availableSizes: ["M"],
          firstPublicAt: expect.any(String),
        }),
      );
      expect(state.repository.getRun(1)).toEqual(
        expect.objectContaining({
          status: "completed",
          productCount: 1,
        }),
      );
    } finally {
      state.close();
    }
  });

  it("keeps retired products on card observation without inspecting unchanged details", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "supplywatch-cli-"));
    const databasePath = join(tempDir, "supplywatch.sqlite");
    const unchangedRetiredProduct = {
      ...DISCOVERED_PRODUCT,
      candidateEvidence: [],
      normalizedSnapshot: {
        ...DISCOVERED_PRODUCT.normalizedSnapshot,
        candidateSignals: [],
        cardEvidence: [],
      },
    };
    const state = openStateRepository(databasePath);
    try {
      state.repository.upsertProduct({
        stableId: unchangedRetiredProduct.stableId,
        name: unchangedRetiredProduct.name,
        url: unchangedRetiredProduct.url,
        imageUrl: unchangedRetiredProduct.imageUrl,
        description: unchangedRetiredProduct.description,
        collection: unchangedRetiredProduct.collection,
        price: unchangedRetiredProduct.price,
        normalizedSnapshot: unchangedRetiredProduct.normalizedSnapshot,
        rawFingerprint: unchangedRetiredProduct.rawFingerprint,
        buyableState: "out_of_stock",
        availableSizes: [],
        firstSeenAt: "2026-06-04T14:00:00.000Z",
        lastSeenAt: "2026-06-04T14:05:00.000Z",
        firstPublicAt: null,
        outOfStockConfirmations: 3,
        retiredAt: "2026-06-04T14:05:00.000Z",
        retirementReason: "three_out_of_stock_confirmations",
      });
    } finally {
      state.close();
    }
    const poll = vi.fn().mockResolvedValue({
      products: [unchangedRetiredProduct],
      observedWindowMs: 15_000,
    });
    const inspect = vi.fn();
    const log = vi.fn();

    await runCli(["poll-once"], {
      loadConfig: () => ({
        SUPPLYWATCH_TARGET_URL: "https://supplyco.openai.com",
        DATABASE_PATH: databasePath,
        DRY_RUN: true,
        DISCORD_WEBHOOK_URL: undefined,
        POLL_INTERVAL_SECONDS: 60,
        OBSERVATION_WINDOW_SECONDS: 15,
        FULL_SWEEP_INTERVAL_MINUTES: 60,
        OUT_OF_STOCK_RETIRE_CONFIRMATIONS: 3,
        NOTIFY_MAX_ATTEMPTS: 10,
      }),
      log,
      poll,
      inspect,
      saveDebugArtifact: vi.fn().mockResolvedValue(undefined),
    });

    expect(inspect).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("inspected: 0"));
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("detail checks skipped: 1"),
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("retired detail checks: 1"),
    );
  });

  it("sends previously pending Discord notifications at worker startup", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "supplywatch-cli-"));
    const databasePath = join(tempDir, "supplywatch.sqlite");
    const state = openStateRepository(databasePath);
    try {
      state.repository.upsertProduct({
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
        availableSizes: ["M"],
        firstSeenAt: "2026-06-04T15:00:00.000Z",
        lastSeenAt: "2026-06-04T15:00:00.000Z",
        firstPublicAt: "2026-06-04T15:00:00.000Z",
        outOfStockConfirmations: 0,
        retiredAt: null,
        retirementReason: null,
      });
      state.repository.recordEvent({
        eventHash: "public-drop-tee-alert",
        eventType: "public_purchase_available",
        productId: "url-products-public-drop-tee",
        payload: {
          alertKind: "merch",
          productId: "url-products-public-drop-tee",
          observedAt: "2026-06-04T15:00:00.000Z",
          productName: "Public Drop Tee",
          productUrl: "https://supplyco.openai.com/products/public-drop-tee",
          imageUrl: "https://cdn.example/public-drop-tee.png",
          description: "Soft launch shirt",
          price: "$28",
          availableSizes: ["M"],
          confidence: "high",
          evidence: [],
        },
        notificationStatus: "pending",
        attemptCount: 0,
        lastAttemptAt: null,
        notificationError: null,
        createdAt: "2026-06-04T15:00:00.000Z",
        notifiedAt: null,
      });
    } finally {
      state.close();
    }
    const sendDiscordWebhook = vi.fn().mockResolvedValue(undefined);

    await runCli(["poll-once"], {
      loadConfig: () => ({
        SUPPLYWATCH_TARGET_URL: "https://supplyco.openai.com",
        DATABASE_PATH: databasePath,
        DRY_RUN: false,
        DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/example",
        POLL_INTERVAL_SECONDS: 60,
        OBSERVATION_WINDOW_SECONDS: 15,
        FULL_SWEEP_INTERVAL_MINUTES: 60,
        OUT_OF_STOCK_RETIRE_CONFIRMATIONS: 3,
        NOTIFY_MAX_ATTEMPTS: 10,
      }),
      log: vi.fn(),
      poll: vi.fn().mockResolvedValue({
        products: [],
        observedWindowMs: 15_000,
      }),
      inspect: vi.fn(),
      saveDebugArtifact: vi.fn().mockResolvedValue(undefined),
      sendDiscordWebhook,
    });

    expect(sendDiscordWebhook).toHaveBeenCalledWith(
      "https://discord.com/api/webhooks/example",
      expect.objectContaining({
        embeds: [expect.objectContaining({ title: "Public Drop Tee" })],
      }),
    );

    const reopened = openStateRepository(databasePath);
    try {
      expect(
        reopened.repository.getEventByHash("public-drop-tee-alert"),
      ).toEqual(
        expect.objectContaining({
          notificationStatus: "sent",
          notifiedAt: expect.any(String),
        }),
      );
    } finally {
      reopened.close();
    }
  });

  it("runs scheduled polls without overlapping in-progress cycles", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "supplywatch-cli-"));
    const databasePath = join(tempDir, "supplywatch.sqlite");
    let continueChecks = 0;
    let activePolls = 0;
    let maxActivePolls = 0;
    const poll = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          activePolls += 1;
          maxActivePolls = Math.max(maxActivePolls, activePolls);
          setTimeout(() => {
            activePolls -= 1;
            resolve({
              products: [],
              observedWindowMs: 15_000,
            });
          }, 20);
        }),
    );
    const sleep = vi.fn().mockResolvedValue(undefined);

    await runCli([], {
      loadConfig: () => ({
        SUPPLYWATCH_TARGET_URL: "https://supplyco.openai.com",
        DATABASE_PATH: databasePath,
        DRY_RUN: true,
        DISCORD_WEBHOOK_URL: undefined,
        POLL_INTERVAL_SECONDS: 60,
        OBSERVATION_WINDOW_SECONDS: 15,
        FULL_SWEEP_INTERVAL_MINUTES: 60,
        OUT_OF_STOCK_RETIRE_CONFIRMATIONS: 3,
        NOTIFY_MAX_ATTEMPTS: 10,
      }),
      log: vi.fn(),
      poll,
      inspect: vi.fn(),
      saveDebugArtifact: vi.fn().mockResolvedValue(undefined),
      sleep,
      shouldContinue: () => continueChecks++ < 4,
    });

    expect(poll).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(maxActivePolls).toBe(1);
  });

  it("performs a full sweep at startup and when the configured cadence elapses", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "supplywatch-cli-"));
    const databasePath = join(tempDir, "supplywatch.sqlite");
    const times = [
      new Date("2026-06-04T15:00:00.000Z"),
      new Date("2026-06-04T15:30:00.000Z"),
      new Date("2026-06-04T16:00:00.000Z"),
    ];
    let nowCalls = 0;
    const poll = vi.fn().mockResolvedValue({
      products: [],
      observedWindowMs: 15_000,
    });
    let continueChecks = 0;

    await runCli([], {
      loadConfig: () => ({
        SUPPLYWATCH_TARGET_URL: "https://supplyco.openai.com",
        DATABASE_PATH: databasePath,
        DRY_RUN: true,
        DISCORD_WEBHOOK_URL: undefined,
        POLL_INTERVAL_SECONDS: 60,
        OBSERVATION_WINDOW_SECONDS: 15,
        FULL_SWEEP_INTERVAL_MINUTES: 60,
        OUT_OF_STOCK_RETIRE_CONFIRMATIONS: 3,
        NOTIFY_MAX_ATTEMPTS: 10,
      }),
      log: vi.fn(),
      poll,
      inspect: vi.fn(),
      saveDebugArtifact: vi.fn().mockResolvedValue(undefined),
      sleep: vi.fn().mockResolvedValue(undefined),
      shouldContinue: () => continueChecks++ < 5,
      now: () =>
        times[Math.min(Math.floor(nowCalls++ / 4), times.length - 1)] ??
        new Date("2026-06-04T16:00:00.000Z"),
    });

    expect(poll).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ fullSweep: true }),
    );
    expect(poll).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ fullSweep: false }),
    );
    expect(poll).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ fullSweep: true }),
    );
  });

  it("records a health alert when a successful poll returns zero products", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "supplywatch-cli-"));
    const databasePath = join(tempDir, "supplywatch.sqlite");

    await runCli(["poll-once"], {
      loadConfig: () => ({
        SUPPLYWATCH_TARGET_URL: "https://supplyco.openai.com",
        DATABASE_PATH: databasePath,
        DRY_RUN: true,
        DISCORD_WEBHOOK_URL: undefined,
        POLL_INTERVAL_SECONDS: 60,
        OBSERVATION_WINDOW_SECONDS: 15,
        FULL_SWEEP_INTERVAL_MINUTES: 60,
        OUT_OF_STOCK_RETIRE_CONFIRMATIONS: 3,
        NOTIFY_MAX_ATTEMPTS: 10,
      }),
      log: vi.fn(),
      poll: vi.fn().mockResolvedValue({
        products: [],
        observedWindowMs: 15_000,
      }),
      inspect: vi.fn(),
      saveDebugArtifact: vi.fn().mockResolvedValue(undefined),
      now: () => new Date("2026-06-04T15:05:00.000Z"),
    });

    const state = openStateRepository(databasePath);
    try {
      const event = state.database
        .prepare("SELECT * FROM events WHERE event_type = ?")
        .get("health_zero_product_run");

      expect(event).toEqual(
        expect.objectContaining({
          product_id: null,
          notification_status: "pending",
        }),
      );
    } finally {
      state.close();
    }
  });

  it("saves an operational artifact and health event when detail inspection fails", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "supplywatch-cli-"));
    const databasePath = join(tempDir, "supplywatch.sqlite");
    const inspectionError = new Error("detail modal did not open");
    const poll = vi.fn().mockResolvedValue({
      products: [DISCOVERED_PRODUCT],
      observedWindowMs: 15_000,
    });
    const saveDebugArtifact = vi.fn().mockResolvedValue(undefined);

    await runCli(["poll-once"], {
      loadConfig: () => ({
        SUPPLYWATCH_TARGET_URL: "https://supplyco.openai.com",
        DATABASE_PATH: databasePath,
        DRY_RUN: true,
        DISCORD_WEBHOOK_URL: undefined,
        POLL_INTERVAL_SECONDS: 60,
        OBSERVATION_WINDOW_SECONDS: 15,
        FULL_SWEEP_INTERVAL_MINUTES: 60,
        OUT_OF_STOCK_RETIRE_CONFIRMATIONS: 3,
        NOTIFY_MAX_ATTEMPTS: 10,
      }),
      log: vi.fn(),
      poll,
      inspect: vi.fn().mockRejectedValue(inspectionError),
      saveDebugArtifact,
    });

    expect(saveDebugArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        directory: join(tempDir, "debug-artifacts"),
        reason: "inspection-error",
        product: DISCOVERED_PRODUCT,
        inspection: null,
        errorMessage: "detail modal did not open",
      }),
    );

    const state = openStateRepository(databasePath);
    try {
      const event = state.database
        .prepare("SELECT * FROM events WHERE event_type = ?")
        .get("health_detail_inspection_failed");

      expect(event).toEqual(
        expect.objectContaining({
          product_id: DISCOVERED_PRODUCT.stableId,
          notification_status: "pending",
        }),
      );
    } finally {
      state.close();
    }
  });
});

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { EventRecord } from "@supplywatch/state";
import {
  type OpenStateRepository,
  openStateRepository,
} from "@supplywatch/state";
import { chromium } from "playwright";
import { loadConfig, redactConfig } from "./config/env.js";
import {
  type DetailInspectionResult,
  inspectProductDetail,
  openProductDetailFromListing,
} from "./detail/inspection.js";
import {
  type ProductDiscoveryPollOptions,
  type ProductDiscoveryPollResult,
  pollRenderedSupplyPage,
} from "./discovery/poll.js";
import type { DiscoveredProduct } from "./discovery/products.js";
import {
  type CaptureProductStateFixtureOptions,
  captureProductStateFixture,
} from "./fixtures/capture.js";
import {
  type DiscordWebhookSender,
  dispatchPendingNotifications,
  type NotificationDispatchOptions,
  type NotificationDispatchResult,
  sendDiscordWebhook,
} from "./notifications/discord.js";
import {
  diffProductSnapshot,
  type ProductSnapshotDiffResult,
  shouldInspectProductSnapshot,
} from "./state/diff.js";

type CliConfig = ReturnType<typeof loadConfig>;

interface CliDependencies {
  capture: (options: CaptureProductStateFixtureOptions) => Promise<{
    directory: string;
  }>;
  loadConfig: typeof loadConfig;
  log: (message: string) => void;
  openStateRepository: (databasePath: string) => OpenStateRepository;
  inspect: (
    product: DiscoveredProduct,
  ) => Promise<DetailInspectionResult | null>;
  saveDebugArtifact: (artifact: DebugArtifact) => Promise<void>;
  poll: (
    options: ProductDiscoveryPollOptions,
  ) => Promise<ProductDiscoveryPollResult>;
  sendDiscordWebhook: DiscordWebhookSender;
  sleep: (milliseconds: number) => Promise<void>;
  shouldContinue: () => boolean;
  now: () => Date;
}

type DebugArtifact = {
  directory: string;
  reason: "confirmed-availability" | "inspection-error";
  product: DiscoveredProduct;
  inspection: DetailInspectionResult | null;
  errorMessage: string | null;
  capturedAt: string;
};

type ProductInspectionAttempt = {
  inspection: DetailInspectionResult | null;
  errorMessage: string | null;
};

type HealthEventInput = {
  eventType: string;
  observedAt: string;
  title: string;
  description: string;
  scope: string;
  productId?: string;
};

const defaultDependencies: CliDependencies = {
  capture: captureProductStateFixture,
  loadConfig,
  log: console.log,
  openStateRepository,
  inspect: inspectDiscoveredProduct,
  saveDebugArtifact,
  poll: pollRenderedSupplyPage,
  sendDiscordWebhook,
  sleep: (milliseconds) =>
    new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    }),
  shouldContinue: () => true,
  now: () => new Date(),
};

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function requireOption(args: string[], name: string): string {
  const value = readOption(args, name);

  if (!value || value.startsWith("--")) {
    throw new Error(`${name} is required`);
  }

  return value;
}

async function runCaptureFixture(
  args: string[],
  dependencies: CliDependencies,
): Promise<void> {
  const fixture = await dependencies.capture({
    url: requireOption(args, "--url"),
    state: requireOption(args, "--state"),
    name: requireOption(args, "--name"),
    outputDir: readOption(args, "--output") ?? "fixtures",
  });

  dependencies.log(`captured fixture: ${fixture.directory}`);
}

async function inspectProductForRun(
  dependencies: Pick<CliDependencies, "inspect" | "saveDebugArtifact">,
  product: DiscoveredProduct,
  artifactDirectory: string,
  capturedAt: string,
): Promise<ProductInspectionAttempt> {
  let inspection: DetailInspectionResult | null = null;

  try {
    inspection = await dependencies.inspect(product);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await dependencies.saveDebugArtifact({
      directory: artifactDirectory,
      reason: "inspection-error",
      product,
      inspection: null,
      errorMessage,
      capturedAt,
    });
    return { inspection: null, errorMessage };
  }

  if (inspection?.buyable) {
    await dependencies.saveDebugArtifact({
      directory: artifactDirectory,
      reason: "confirmed-availability",
      product,
      inspection,
      errorMessage: null,
      capturedAt,
    });
  }

  return { inspection, errorMessage: null };
}

async function runPollCycle(
  dependencies: CliDependencies,
  options: { fullSweep: boolean },
): Promise<void> {
  const config = dependencies.loadConfig();

  const state = dependencies.openStateRepository(config.DATABASE_PATH);
  const run = state.repository.startRun(dependencies.now().toISOString());

  try {
    const discovery = await dependencies.poll({
      targetUrl: config.SUPPLYWATCH_TARGET_URL,
      observationWindowMs: config.OBSERVATION_WINDOW_SECONDS * 1000,
      fullSweep: options.fullSweep,
    });
    const observedAt = dependencies.now().toISOString();
    const debugArtifactDirectory = join(
      dirname(config.DATABASE_PATH),
      "debug-artifacts",
    );
    const inspections = new Map<string, DetailInspectionResult>();
    const diffs: ProductSnapshotDiffResult[] = [];

    if (discovery.products.length === 0) {
      recordHealthEvent(state.repository, {
        eventType: "health_zero_product_run",
        observedAt,
        title: "Supplywatch zero-product run",
        description: "Rendered page returned no products.",
        scope: "discovery",
      });
    }

    for (const product of discovery.products) {
      const existing = state.repository.getProduct(product.stableId);
      const override = state.repository.getProductOverride(product.stableId);
      const shouldInspect = shouldInspectProductSnapshot({
        product,
        existing,
        override,
        fullSweep: options.fullSweep,
      });
      const inspectionAttempt = shouldInspect
        ? await inspectProductForRun(
            dependencies,
            product,
            debugArtifactDirectory,
            observedAt,
          )
        : { inspection: null, errorMessage: null };
      const inspection = inspectionAttempt.inspection;
      const diff = diffProductSnapshot(state.repository, {
        product,
        inspection,
        observedAt,
        retireAfterOutOfStockConfirmations:
          config.OUT_OF_STOCK_RETIRE_CONFIRMATIONS,
      });

      if (inspection) {
        inspections.set(product.stableId, inspection);

        if (inspection.confidence === "low") {
          recordHealthEvent(state.repository, {
            eventType: "health_low_confidence_classification",
            observedAt,
            title: "Supplywatch low-confidence classification",
            description:
              "Product detail inspection completed with low confidence.",
            scope: "detail-inspection",
            productId: product.stableId,
          });
        }
      }

      if (inspectionAttempt.errorMessage) {
        recordHealthEvent(state.repository, {
          eventType: "health_detail_inspection_failed",
          observedAt,
          title: "Supplywatch detail inspection failed",
          description: inspectionAttempt.errorMessage,
          scope: "detail-inspection",
          productId: product.stableId,
        });
      }

      if (!product.name || !product.imageUrl) {
        recordHealthEvent(state.repository, {
          eventType: "health_missing_product_identity",
          observedAt,
          title: "Supplywatch missing product identity",
          description:
            "A rendered product card is missing a product name or image.",
          scope: "discovery",
          productId: product.stableId,
        });
      }

      diffs.push(diff);
    }

    logDryRunSummary(dependencies, discovery.products, inspections, diffs);

    const notificationResult = await dispatchNotificationsForRun(
      state.repository,
      config,
      dependencies,
    );

    dependencies.log(`Discord sends: ${notificationResult.sent}`);
    dependencies.log(`Discord dry-run alerts: ${notificationResult.dryRun}`);
    dependencies.log(`Discord failed alerts: ${notificationResult.failed}`);

    state.repository.finishRun(run.id, {
      finishedAt: dependencies.now().toISOString(),
      status: "completed",
      productCount: discovery.products.length,
      errorMessage: null,
    });
  } catch (error) {
    const finishedAt = dependencies.now().toISOString();
    const errorMessage = errorMessageFromUnknown(error);

    recordHealthEvent(state.repository, {
      eventType: "health_poll_failed",
      observedAt: finishedAt,
      title: "Supplywatch poll failed",
      description: errorMessage,
      scope: "poll",
    });
    state.repository.finishRun(run.id, {
      finishedAt,
      status: "failed",
      productCount: 0,
      errorMessage,
    });
    throw error;
  } finally {
    state.close();
  }
}

function recordHealthEvent(
  repository: OpenStateRepository["repository"],
  options: HealthEventInput,
): void {
  repository.recordEvent(buildHealthEvent(options));
}

function buildHealthEvent(options: HealthEventInput): EventRecord {
  const rateLimitBucket = options.observedAt.slice(0, 13);

  return {
    eventHash: hash(
      JSON.stringify({
        eventType: options.eventType,
        productId: options.productId ?? null,
        rateLimitBucket,
      }),
    ),
    eventType: options.eventType,
    productId: options.productId ?? null,
    payload: {
      alertKind: "health",
      observedAt: options.observedAt,
      title: options.title,
      description: options.description,
      scope: options.scope,
    },
    notificationStatus: "pending",
    attemptCount: 0,
    lastAttemptAt: null,
    notificationError: null,
    createdAt: options.observedAt,
    notifiedAt: null,
  };
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function dispatchStartupNotifications(
  config: CliConfig,
  dependencies: CliDependencies,
): Promise<void> {
  const state = dependencies.openStateRepository(config.DATABASE_PATH);

  try {
    await dispatchNotificationsForRun(state.repository, config, dependencies);
  } finally {
    state.close();
  }
}

async function runWorker(dependencies: CliDependencies): Promise<void> {
  const config = dependencies.loadConfig();

  logWorkerStartup(dependencies, config);
  await dispatchStartupNotifications(config, dependencies);

  let lastFullSweepAt = 0;

  while (dependencies.shouldContinue()) {
    const now = dependencies.now().getTime();
    const fullSweep = shouldRunFullSweep({
      now,
      lastFullSweepAt,
      intervalMinutes: config.FULL_SWEEP_INTERVAL_MINUTES,
    });

    try {
      await runPollCycle(dependencies, { fullSweep });
      if (fullSweep) {
        lastFullSweepAt = now;
      }
    } catch (error) {
      dependencies.log(`poll failed: ${errorMessageFromUnknown(error)}`);
    }

    if (dependencies.shouldContinue()) {
      await dependencies.sleep(config.POLL_INTERVAL_SECONDS * 1000);
    }
  }
}

function shouldRunFullSweep(options: {
  now: number;
  lastFullSweepAt: number;
  intervalMinutes: number;
}): boolean {
  const fullSweepIntervalMs = options.intervalMinutes * 60_000;

  return (
    options.lastFullSweepAt === 0 ||
    options.now - options.lastFullSweepAt >= fullSweepIntervalMs
  );
}

async function dispatchNotificationsForRun(
  repository: OpenStateRepository["repository"],
  config: CliConfig,
  dependencies: Pick<CliDependencies, "sendDiscordWebhook" | "log">,
): Promise<NotificationDispatchResult> {
  return dispatchPendingNotifications(repository, {
    ...notificationDispatchOptions(config, dependencies),
    now: new Date().toISOString(),
  });
}

function notificationDispatchOptions(
  config: CliConfig,
  dependencies: Pick<CliDependencies, "sendDiscordWebhook" | "log">,
): Omit<NotificationDispatchOptions, "now"> {
  return {
    dryRun: config.DRY_RUN,
    webhookUrl: config.DISCORD_WEBHOOK_URL,
    maxAttempts: config.NOTIFY_MAX_ATTEMPTS,
    send: dependencies.sendDiscordWebhook,
    log: dependencies.log,
  };
}

async function inspectDiscoveredProduct(
  product: DiscoveredProduct,
): Promise<DetailInspectionResult | null> {
  if (!product.url && !product.sourcePageUrl) {
    return null;
  }

  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();

    if (!product.url) {
      await openProductDetailFromListing(page, product);
    }

    return await inspectProductDetail(page, product);
  } finally {
    await browser.close();
  }
}

async function saveDebugArtifact(artifact: DebugArtifact): Promise<void> {
  await mkdir(artifact.directory, { recursive: true });

  await writeFile(
    join(
      artifact.directory,
      `${safeFilePart(artifact.capturedAt)}-${safeFilePart(
        artifact.product.stableId,
      )}-${artifact.reason}.json`,
    ),
    `${JSON.stringify(artifact, null, 2)}\n`,
    "utf8",
  );
}

function logDryRunSummary(
  dependencies: Pick<CliDependencies, "log">,
  products: DiscoveredProduct[],
  inspections: Map<string, DetailInspectionResult>,
  diffs: ProductSnapshotDiffResult[],
): void {
  const inspectedCount = inspections.size;
  const confirmedPublicAvailabilityCount = Array.from(
    inspections.values(),
  ).filter((inspection) => inspection.buyable).length;
  const skippedDetailCheckCount = products.length - inspectedCount;
  const candidateSignals = Array.from(
    new Set(
      products.flatMap((product) =>
        product.candidateEvidence.map((evidence) => evidence.signal),
      ),
    ),
  );
  const events = diffs.flatMap((diff) => diff.events);
  const merchEventCount = events.filter(
    (event) => event.payload.alertKind === "merch",
  ).length;
  const retiredDetailCheckCount = diffs.filter(
    (diff) => diff.product.retiredAt,
  ).length;

  dependencies.log("dry-run product discovery summary");
  dependencies.log(`products found: ${products.length}`);
  dependencies.log(`persisted observations: ${products.length}`);
  dependencies.log(
    `candidate signals: ${candidateSignals.length > 0 ? candidateSignals.join(", ") : "none"}`,
  );
  dependencies.log(`inspected: ${inspectedCount}`);
  dependencies.log(
    `confirmed public availability: ${confirmedPublicAvailabilityCount}`,
  );
  dependencies.log(`detail checks skipped: ${skippedDetailCheckCount}`);
  dependencies.log(`retired detail checks: ${retiredDetailCheckCount}`);
  dependencies.log(`events recorded: ${events.length}`);
  dependencies.log(`would-notify events: ${merchEventCount}`);
  dependencies.log("Discord sends: 0");
}

function safeFilePart(value: string): string {
  return value.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "");
}

function errorMessageFromUnknown(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function logWorkerStartup(
  dependencies: Pick<CliDependencies, "log">,
  config: CliConfig,
): void {
  dependencies.log("supplywatch worker starting");
  dependencies.log(JSON.stringify(redactConfig(config), null, 2));
}

export async function runCli(
  args: string[],
  dependencyOverrides: Partial<CliDependencies> = {},
): Promise<void> {
  const dependencies = {
    ...defaultDependencies,
    ...dependencyOverrides,
  };
  const [command, ...commandArgs] = args;

  if (command === "capture-fixture") {
    await runCaptureFixture(commandArgs, dependencies);
    return;
  }

  if (command === "poll-once") {
    const config = dependencies.loadConfig();

    logWorkerStartup(dependencies, config);
    await dispatchStartupNotifications(config, dependencies);

    await runPollCycle(dependencies, { fullSweep: false });
    return;
  }

  await runWorker(dependencies);
}

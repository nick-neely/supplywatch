import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { chromium } from "playwright";
import { loadConfig, redactConfig } from "./config/env.js";
import {
  type DetailInspectionResult,
  inspectProductDetail,
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
  type OpenStateRepository,
  openStateRepository,
} from "./state/database.js";
import {
  diffProductSnapshot,
  type ProductSnapshotDiffResult,
  shouldInspectProductSnapshot,
} from "./state/diff.js";

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
}

type DebugArtifact = {
  directory: string;
  reason: "confirmed-availability" | "inspection-error";
  product: DiscoveredProduct;
  inspection: DetailInspectionResult | null;
  errorMessage: string | null;
  capturedAt: string;
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
): Promise<DetailInspectionResult | null> {
  let inspection: DetailInspectionResult | null = null;

  try {
    inspection = await dependencies.inspect(product);
  } catch (error) {
    await dependencies.saveDebugArtifact({
      directory: artifactDirectory,
      reason: "inspection-error",
      product,
      inspection: null,
      errorMessage: error instanceof Error ? error.message : String(error),
      capturedAt,
    });
    throw error;
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

  return inspection;
}

async function runWorker(dependencies: CliDependencies): Promise<void> {
  const config = dependencies.loadConfig();

  dependencies.log("supplywatch worker starting");
  dependencies.log(JSON.stringify(redactConfig(config), null, 2));

  const state = dependencies.openStateRepository(config.DATABASE_PATH);
  const run = state.repository.startRun(new Date().toISOString());

  try {
    await dispatchNotificationsForRun(state.repository, config, dependencies);

    const discovery = await dependencies.poll({
      targetUrl: config.SUPPLYWATCH_TARGET_URL,
      observationWindowMs: config.OBSERVATION_WINDOW_SECONDS * 1000,
    });
    const observedAt = new Date().toISOString();
    const debugArtifactDirectory = join(
      dirname(config.DATABASE_PATH),
      "debug-artifacts",
    );
    const inspections = new Map<string, DetailInspectionResult>();
    const diffs: ProductSnapshotDiffResult[] = [];

    for (const product of discovery.products) {
      const existing = state.repository.getProduct(product.stableId);
      const override = state.repository.getProductOverride(product.stableId);
      const shouldInspect = shouldInspectProductSnapshot({
        product,
        existing,
        override,
      });
      const inspection = shouldInspect
        ? await inspectProductForRun(
            dependencies,
            product,
            debugArtifactDirectory,
            observedAt,
          )
        : null;
      const diff = diffProductSnapshot(state.repository, {
        product,
        inspection,
        observedAt,
        retireAfterOutOfStockConfirmations:
          config.OUT_OF_STOCK_RETIRE_CONFIRMATIONS,
      });

      if (inspection) {
        inspections.set(product.stableId, inspection);
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
      finishedAt: new Date().toISOString(),
      status: "completed",
      productCount: discovery.products.length,
      errorMessage: null,
    });
  } catch (error) {
    state.repository.finishRun(run.id, {
      finishedAt: new Date().toISOString(),
      status: "failed",
      productCount: 0,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    state.close();
  }
}

async function dispatchNotificationsForRun(
  repository: OpenStateRepository["repository"],
  config: ReturnType<typeof loadConfig>,
  dependencies: Pick<CliDependencies, "sendDiscordWebhook" | "log">,
): Promise<NotificationDispatchResult> {
  return dispatchPendingNotifications(repository, {
    ...notificationDispatchOptions(config, dependencies),
    now: new Date().toISOString(),
  });
}

function notificationDispatchOptions(
  config: ReturnType<typeof loadConfig>,
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
  if (!product.url) {
    return null;
  }

  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
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

  await runWorker(dependencies);
}

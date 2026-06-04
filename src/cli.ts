import { loadConfig, redactConfig } from "./config/env.js";
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
  type OpenStateRepository,
  openStateRepository,
} from "./state/database.js";
import type { ProductRecord } from "./state/repository.js";

interface CliDependencies {
  capture: (options: CaptureProductStateFixtureOptions) => Promise<{
    directory: string;
  }>;
  loadConfig: typeof loadConfig;
  log: (message: string) => void;
  openStateRepository: (databasePath: string) => OpenStateRepository;
  poll: (
    options: ProductDiscoveryPollOptions,
  ) => Promise<ProductDiscoveryPollResult>;
}

const defaultDependencies: CliDependencies = {
  capture: captureProductStateFixture,
  loadConfig,
  log: console.log,
  openStateRepository,
  poll: pollRenderedSupplyPage,
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

async function runWorker(dependencies: CliDependencies): Promise<void> {
  const config = dependencies.loadConfig();

  dependencies.log("supplywatch worker starting");
  dependencies.log(JSON.stringify(redactConfig(config), null, 2));

  const state = dependencies.openStateRepository(config.DATABASE_PATH);
  const run = state.repository.startRun(new Date().toISOString());

  try {
    const discovery = await dependencies.poll({
      targetUrl: config.SUPPLYWATCH_TARGET_URL,
      observationWindowMs: config.OBSERVATION_WINDOW_SECONDS * 1000,
    });
    const observedAt = new Date().toISOString();

    for (const product of discovery.products) {
      const existing = state.repository.getProduct(product.stableId);

      state.repository.upsertProduct(
        productObservationRecord(product, existing, observedAt),
      );
    }

    logDryRunSummary(dependencies, discovery.products);

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

function productObservationRecord(
  product: DiscoveredProduct,
  existing: ProductRecord | null,
  observedAt: string,
): ProductRecord {
  return {
    stableId: product.stableId,
    name: product.name,
    url: product.url,
    imageUrl: product.imageUrl,
    description: product.description,
    collection: product.collection,
    price: product.price,
    normalizedSnapshot: product.normalizedSnapshot,
    rawFingerprint: product.rawFingerprint,
    buyableState: existing?.buyableState ?? "unknown",
    availableSizes: existing?.availableSizes ?? [],
    firstSeenAt: existing?.firstSeenAt ?? observedAt,
    lastSeenAt: observedAt,
    firstPublicAt: existing?.firstPublicAt ?? null,
    outOfStockConfirmations: existing?.outOfStockConfirmations ?? 0,
    retiredAt: existing?.retiredAt ?? null,
    retirementReason: existing?.retirementReason ?? null,
  };
}

function logDryRunSummary(
  dependencies: Pick<CliDependencies, "log">,
  products: DiscoveredProduct[],
): void {
  const candidateSignals = Array.from(
    new Set(
      products.flatMap((product) =>
        product.candidateEvidence.map((evidence) => evidence.signal),
      ),
    ),
  );

  dependencies.log("dry-run product discovery summary");
  dependencies.log(`products found: ${products.length}`);
  dependencies.log(`persisted observations: ${products.length}`);
  dependencies.log(
    `candidate signals: ${candidateSignals.length > 0 ? candidateSignals.join(", ") : "none"}`,
  );
  dependencies.log(`detail checks skipped: ${products.length}`);
  dependencies.log("retired detail checks: 0");
  dependencies.log("Discord sends: 0");
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

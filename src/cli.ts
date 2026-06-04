import { createHash } from "node:crypto";
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
  inspect: (
    product: DiscoveredProduct,
  ) => Promise<DetailInspectionResult | null>;
  saveDebugArtifact: (artifact: DebugArtifact) => Promise<void>;
  poll: (
    options: ProductDiscoveryPollOptions,
  ) => Promise<ProductDiscoveryPollResult>;
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
    const debugArtifactDirectory = join(
      dirname(config.DATABASE_PATH),
      "debug-artifacts",
    );
    const inspections = new Map<string, DetailInspectionResult>();

    for (const product of discovery.products) {
      const existing = state.repository.getProduct(product.stableId);
      let inspection: DetailInspectionResult | null = null;

      try {
        inspection = await dependencies.inspect(product);
      } catch (error) {
        await dependencies.saveDebugArtifact({
          directory: debugArtifactDirectory,
          reason: "inspection-error",
          product,
          inspection: null,
          errorMessage: error instanceof Error ? error.message : String(error),
          capturedAt: observedAt,
        });
        throw error;
      }

      if (inspection) {
        inspections.set(product.stableId, inspection);
      }

      if (inspection?.buyable) {
        await dependencies.saveDebugArtifact({
          directory: debugArtifactDirectory,
          reason: "confirmed-availability",
          product,
          inspection,
          errorMessage: null,
          capturedAt: observedAt,
        });
      }

      state.repository.upsertProduct(
        productObservationRecord(product, existing, observedAt, inspection),
      );
    }

    logDryRunSummary(dependencies, discovery.products, inspections);

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
  inspection: DetailInspectionResult | null,
): ProductRecord {
  const normalizedSnapshot = normalizedProductSnapshot(product, inspection);
  const buyableState = buyableStateFromInspection(inspection, existing);
  const isFirstPublicObservation =
    buyableState === "publicly_buyable" && !existing?.firstPublicAt;

  return {
    stableId: product.stableId,
    name: product.name,
    url: product.url,
    imageUrl: product.imageUrl,
    description: product.description,
    collection: product.collection,
    price: product.price,
    normalizedSnapshot,
    rawFingerprint: fingerprintSnapshot(normalizedSnapshot),
    buyableState,
    availableSizes:
      inspection?.availableSizes ?? existing?.availableSizes ?? [],
    firstSeenAt: existing?.firstSeenAt ?? observedAt,
    lastSeenAt: observedAt,
    firstPublicAt:
      existing?.firstPublicAt ?? (isFirstPublicObservation ? observedAt : null),
    outOfStockConfirmations: existing?.outOfStockConfirmations ?? 0,
    retiredAt: existing?.retiredAt ?? null,
    retirementReason: existing?.retirementReason ?? null,
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
  dependencies.log(`inspected: ${inspections.size}`);
  dependencies.log(
    `confirmed public availability: ${
      Array.from(inspections.values()).filter(
        (inspection) => inspection.buyable,
      ).length
    }`,
  );
  dependencies.log(
    `detail checks skipped: ${products.length - inspections.size}`,
  );
  dependencies.log("retired detail checks: 0");
  dependencies.log("Discord sends: 0");
}

function normalizedProductSnapshot(
  product: DiscoveredProduct,
  inspection: DetailInspectionResult | null,
): ProductRecord["normalizedSnapshot"] {
  if (!inspection) {
    return product.normalizedSnapshot;
  }

  return {
    ...product.normalizedSnapshot,
    detail: {
      buyable: inspection.buyable,
      confidence: inspection.confidence,
      availableSizes: inspection.availableSizes,
      disabledSizes: inspection.disabledSizes,
      actionEvidence: inspection.actionEvidence,
      detailText: inspection.detailText,
      evidence: inspection.evidence,
      productUrl: inspection.productUrl,
    },
  };
}

function buyableStateFromInspection(
  inspection: DetailInspectionResult | null,
  existing: ProductRecord | null,
): ProductRecord["buyableState"] {
  if (!inspection) {
    return existing?.buyableState ?? "unknown";
  }

  if (inspection.buyable) {
    return "publicly_buyable";
  }

  const hasEmployeeGate = inspection.detectors.some(
    (detector) => detector.name === "employee-gated" && detector.matched,
  );

  return hasEmployeeGate ? "employee_only" : "out_of_stock";
}

function fingerprintSnapshot(
  snapshot: ProductRecord["normalizedSnapshot"],
): string {
  const { observedAt: _observedAt, ...stableSnapshot } = snapshot;

  return createHash("sha256").update(stableJson(stableSnapshot)).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, entryValue]) =>
          `${JSON.stringify(key)}:${stableJson(entryValue)}`,
      )
      .join(",")}}`;
  }

  return JSON.stringify(value);
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

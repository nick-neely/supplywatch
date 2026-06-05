import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  openStateRepository,
  type ProductRecord,
  WatcherStateRepository,
} from "@supplywatch/state";
import { describe, expect, it } from "vitest";
import { resolveDatabasePath } from "../packages/state/src/migrate.js";

const PRODUCT: ProductRecord = {
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
};

describe("shared state package", () => {
  it("exposes persistent watcher state without importing watcher internals", () => {
    const directory = mkdtempSync(join(tmpdir(), "supplywatch-state-package-"));
    const databasePath = join(directory, "supplywatch.sqlite");
    const state = openStateRepository(databasePath);

    try {
      expect(state.repository).toBeInstanceOf(WatcherStateRepository);

      state.repository.upsertProduct(PRODUCT);
      expect(state.repository.getProduct(PRODUCT.stableId)).toEqual(PRODUCT);
    } finally {
      state.close();
      rmSync(directory, { force: true, recursive: true });
    }
  });
});

describe("state migration script paths", () => {
  it("resolves relative database paths from the pnpm invocation directory", () => {
    const originalInitCwd = process.env.INIT_CWD;

    try {
      process.env.INIT_CWD = "/workspace/supplywatch";

      expect(resolveDatabasePath(undefined)).toBe(
        "/workspace/supplywatch/data/supplywatch.sqlite",
      );
      expect(resolveDatabasePath("./data/review.sqlite")).toBe(
        "/workspace/supplywatch/data/review.sqlite",
      );
      expect(resolveDatabasePath("/var/lib/supplywatch.sqlite")).toBe(
        "/var/lib/supplywatch.sqlite",
      );
      expect(resolveDatabasePath(":memory:")).toBe(":memory:");
    } finally {
      if (originalInitCwd === undefined) {
        delete process.env.INIT_CWD;
      } else {
        process.env.INIT_CWD = originalInitCwd;
      }
    }
  });
});

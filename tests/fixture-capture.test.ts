import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeCapturedFixture } from "../src/fixtures/capture.js";

describe("fixture capture", () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it("writes rendered HTML and metadata under the product state", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "supplywatch-fixtures-"));

    const fixture = await writeCapturedFixture({
      outputDir: tempDir,
      state: "sizeless",
      name: "public-drop-tee",
      url: "https://supplyco.openai.com/products/public-drop-tee",
      html: "<main><h1>Public Drop Tee</h1></main>",
      capturedAt: "2026-06-04T15:00:00.000Z",
    });

    await expect(readFile(fixture.htmlPath, "utf8")).resolves.toContain(
      "Public Drop Tee",
    );
    await expect(readFile(fixture.metadataPath, "utf8")).resolves.toContain(
      '"state": "sizeless"',
    );
    expect(fixture.directory).toBe(
      join(tempDir, "product-states", "sizeless", "public-drop-tee"),
    );
  });
});

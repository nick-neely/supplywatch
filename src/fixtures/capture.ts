import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

export type ProductFixtureState =
  | "out-of-stock"
  | "purchase-button"
  | "employee-gated-login"
  | "sized"
  | "sizeless"
  | "disabled-size"
  | "enabled-size"
  | "animate-wiggle-candidate";

export interface CapturedFixtureMetadata {
  state: ProductFixtureState | string;
  name: string;
  url: string;
  capturedAt: string;
}

export interface WriteCapturedFixtureOptions extends CapturedFixtureMetadata {
  outputDir: string;
  html: string;
}

export interface CapturedFixturePaths {
  directory: string;
  htmlPath: string;
  metadataPath: string;
}

export async function writeCapturedFixture(
  options: WriteCapturedFixtureOptions,
): Promise<CapturedFixturePaths> {
  const directory = join(
    options.outputDir,
    "product-states",
    options.state,
    options.name,
  );
  const htmlPath = join(directory, "detail.html");
  const metadataPath = join(directory, "metadata.json");
  const metadata = {
    state: options.state,
    name: options.name,
    url: options.url,
    capturedAt: options.capturedAt,
  } satisfies CapturedFixtureMetadata;

  await mkdir(directory, { recursive: true });
  await writeFile(htmlPath, options.html, "utf8");
  await writeFile(
    metadataPath,
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );

  return { directory, htmlPath, metadataPath };
}

export interface CaptureProductStateFixtureOptions {
  outputDir: string;
  state: ProductFixtureState | string;
  name: string;
  url: string;
}

export async function captureProductStateFixture(
  options: CaptureProductStateFixtureOptions,
): Promise<CapturedFixturePaths> {
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    await page.goto(options.url, { waitUntil: "networkidle" });
    const html = await page.content();

    return await writeCapturedFixture({
      outputDir: options.outputDir,
      state: options.state,
      name: options.name,
      url: options.url,
      html,
      capturedAt: new Date().toISOString(),
    });
  } finally {
    await browser.close();
  }
}

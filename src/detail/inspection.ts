import * as cheerio from "cheerio";
import { classifyAvailability } from "../availability/classifier.js";
import { detectAvailabilitySignals } from "../availability/detectors.js";
import type {
  AvailabilityResult,
  DetectorConfidence,
  DetectorResult,
} from "../availability/types.js";
import type { DiscoveredProduct } from "../discovery/products.js";

export type DetailActionEvidence = {
  label: string;
  disabled: boolean;
  href: string | null;
};

export type DetailSizeEvidence = {
  label: string;
  disabled: boolean;
};

export type DetailInspectionResult = {
  stableId: string;
  productUrl: string | null;
  description: string | null;
  buyable: boolean;
  confidence: DetectorConfidence;
  availableSizes: string[];
  disabledSizes: string[];
  actionEvidence: DetailActionEvidence[];
  detailText: string;
  evidence: AvailabilityResult["evidence"];
  detectors: DetectorResult[];
  verificationBoundary: string;
};

export type ProductDetailPage = {
  url: () => string;
  goto?: (
    url: string,
    options: { waitUntil: "networkidle" },
  ) => Promise<unknown>;
  content: () => Promise<string>;
  click?: (selector: string) => Promise<unknown>;
};

export type ProductListingPage = {
  goto: (
    url: string,
    options: { waitUntil: "networkidle" },
  ) => Promise<unknown>;
  getByAltText: (
    text: string,
    options: { exact: boolean },
  ) => ProductListingLocator;
  locator: (selector: string) => ProductListingLocator;
  waitForTimeout: (milliseconds: number) => Promise<void>;
};

export type ProductListingLocator = {
  filter: (options: { hasText: string | RegExp }) => ProductListingLocator;
  first: () => ProductListingLocator;
  click: (options: { timeout: number }) => Promise<unknown>;
};

const ACTION_SELECTOR = "button, a[href], [role='button']";
const SIZE_SELECTOR = "[data-size], button";
const SIZE_TEXT = /^(xs|s|m|l|xl|xxl|\d+)$/i;
const PRODUCT_CARD_SELECTOR =
  "article, li, button, [role='button'], [class*='product'], [class*='card']";

export async function openProductDetailFromListing(
  page: ProductListingPage,
  product: DiscoveredProduct,
): Promise<void> {
  if (!product.sourcePageUrl) {
    throw new Error(`Product ${product.stableId} has no source page URL`);
  }

  await page.goto(product.sourcePageUrl, { waitUntil: "networkidle" });

  if (!product.name) {
    throw new Error(
      `Could not find clickable product card for ${product.stableId}`,
    );
  }

  await clickFirstMatchingProductLocator(page, product.name);
  await page.waitForTimeout(500);
}

export async function inspectProductDetail(
  page: ProductDetailPage,
  product: DiscoveredProduct,
): Promise<DetailInspectionResult> {
  if (product.url && page.url() !== product.url) {
    await page.goto?.(product.url, { waitUntil: "networkidle" });
  }

  let result = inspectProductDetailHtml(await page.content(), product);

  if (result.buyable || !page.click) {
    return result;
  }

  for (const size of result.availableSizes) {
    await page.click(sizeSelector(size));
    result = inspectProductDetailHtml(await page.content(), product);

    if (result.buyable) {
      return result;
    }
  }

  return result;
}

export function inspectProductDetailHtml(
  html: string,
  product: DiscoveredProduct,
): DetailInspectionResult {
  const detailHtml = extractDetailHtml(html);
  const extracted = extractDetailEvidence(detailHtml);
  const availability = classifyAvailability(
    detectAvailabilitySignals(detailHtml),
  );

  return {
    stableId: product.stableId,
    productUrl: product.url,
    description: extracted.description,
    buyable: availability.buyable,
    confidence: availability.confidence,
    availableSizes: extracted.sizes
      .filter((size) => !size.disabled)
      .map((size) => size.label),
    disabledSizes: extracted.sizes
      .filter((size) => size.disabled)
      .map((size) => size.label),
    actionEvidence: extracted.actions,
    detailText: extracted.detailText,
    evidence: availability.evidence,
    detectors: availability.detectors,
    verificationBoundary: availability.verificationBoundary,
  };
}

function extractDetailHtml(html: string): string {
  const $ = cheerio.load(html);
  const modal = $(".window").last();

  return modal.length > 0 ? $.html(modal) : html;
}

function extractDetailEvidence(html: string): {
  actions: DetailActionEvidence[];
  sizes: DetailSizeEvidence[];
  description: string | null;
  detailText: string;
} {
  const $ = cheerio.load(html);
  const detailText = normalizeWhitespace($("body").text());

  return {
    actions: $(ACTION_SELECTOR)
      .toArray()
      .map((node) => {
        const element = $(node);

        return {
          label: normalizeWhitespace(element.text()),
          disabled: isDisabled(element),
          href: element.attr("href") ?? null,
        };
      })
      .filter((action) => action.label || action.href),
    sizes: $(SIZE_SELECTOR)
      .toArray()
      .map((node) => {
        const element = $(node);
        const label = normalizeWhitespace(
          element.attr("data-size") ?? element.text(),
        );

        return {
          label,
          disabled: isDisabled(element),
        };
      })
      .filter((size) => SIZE_TEXT.test(size.label)),
    description: detailDescription($),
    detailText,
  };
}

function detailDescription($: cheerio.CheerioAPI): string | null {
  const title = normalizeWhitespace($("h1,h2,h3,h4").first().text());
  const actionLabels = new Set(
    $(ACTION_SELECTOR)
      .toArray()
      .map((node) => normalizeWhitespace($(node).text()).toLowerCase())
      .filter(Boolean),
  );

  for (const node of $("p").toArray()) {
    const text = normalizeWhitespace($(node).text());
    const normalizedText = text.toLowerCase();

    if (
      text &&
      text !== title &&
      !actionLabels.has(normalizedText) &&
      !SIZE_TEXT.test(text) &&
      !/^(out of stock|sold out|unavailable)$/i.test(text)
    ) {
      return text;
    }
  }

  return null;
}

function isDisabled(element: ReturnType<cheerio.CheerioAPI>): boolean {
  return (
    element.is(":disabled") ||
    element.attr("disabled") !== undefined ||
    element.attr("aria-disabled") === "true"
  );
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sizeSelector(label: string): string {
  return `[data-size='${label.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}']`;
}

async function clickFirstMatchingProductLocator(
  page: ProductListingPage,
  productName: string,
): Promise<void> {
  const errors: unknown[] = [];
  const locators = [
    page.locator(productImageButtonSelector(productName)).first(),
    page.getByAltText(productName, { exact: true }).first(),
    page
      .locator(PRODUCT_CARD_SELECTOR)
      .filter({ hasText: productName })
      .first(),
  ];

  for (const locator of locators) {
    try {
      await locator.click({ timeout: 5_000 });
      return;
    } catch (error) {
      errors.push(error);
    }
  }

  throw errors[errors.length - 1] ?? new Error("No matching product locator");
}

function productImageButtonSelector(productName: string): string {
  return `button:has(img[alt="${cssString(productName)}"])`;
}

function cssString(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

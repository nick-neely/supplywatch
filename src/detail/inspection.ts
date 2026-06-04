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

const ACTION_SELECTOR = "button, a[href], [role='button']";
const SIZE_SELECTOR = "[data-size], button";
const SIZE_TEXT = /^(xs|s|m|l|xl|xxl|\d+)$/i;

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
  const extracted = extractDetailEvidence(html);
  const availability = classifyAvailability(detectAvailabilitySignals(html));

  return {
    stableId: product.stableId,
    productUrl: product.url,
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

function extractDetailEvidence(html: string): {
  actions: DetailActionEvidence[];
  sizes: DetailSizeEvidence[];
  detailText: string;
} {
  const $ = cheerio.load(html);

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
    detailText: normalizeWhitespace($("body").text()),
  };
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

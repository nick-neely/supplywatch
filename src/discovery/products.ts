import { createHash } from "node:crypto";
import type { JsonObject } from "@supplywatch/state";
import * as cheerio from "cheerio";

export type CandidateEvidence = {
  signal: string;
  source: "class";
  value: string;
};

export type DiscoveredProduct = {
  stableId: string;
  name: string | null;
  url: string | null;
  sourcePageUrl?: string;
  imageUrl: string | null;
  description: string | null;
  collection: string | null;
  price: string | null;
  candidateEvidence: CandidateEvidence[];
  normalizedSnapshot: JsonObject;
  rawFingerprint: string;
};

export type ProductExtractionOptions = {
  pageUrl: string;
  observedAt: string;
};

type ProductFields = Omit<
  DiscoveredProduct,
  "stableId" | "normalizedSnapshot" | "rawFingerprint"
>;

type ProductTextFields = Omit<ProductFields, "candidateEvidence">;

type CheerioSelection = ReturnType<cheerio.CheerioAPI>;

const PRODUCT_SELECTORS = [
  "a[href*='/products/']",
  "article",
  "li",
  "[class*='product']",
  "[class*='card']",
].join(",");

const PRICE_PATTERN = /(?:[$][\d,.]+|free)\b/i;

export function extractProductCardsFromHtml(
  html: string,
  options: ProductExtractionOptions,
): DiscoveredProduct[] {
  const $ = cheerio.load(html);
  const products = new Map<string, DiscoveredProduct>();

  $(PRODUCT_SELECTORS).each((_, element) => {
    const card = $(element);
    const fields = extractProductFields($, card, options.pageUrl);

    if (!looksLikeProduct(fields)) {
      return;
    }

    const product = buildDiscoveredProduct(fields, options);
    const existing = products.get(product.stableId);

    products.set(
      product.stableId,
      existing ? mergeProducts(existing, product) : product,
    );
  });

  return Array.from(products.values());
}

function extractProductFields(
  $: cheerio.CheerioAPI,
  card: CheerioSelection,
  pageUrl: string,
): ProductFields {
  return {
    ...extractProductTextFields($, card, pageUrl),
    candidateEvidence: candidateEvidence($, card),
  };
}

function extractProductTextFields(
  $: cheerio.CheerioAPI,
  card: CheerioSelection,
  pageUrl: string,
): ProductTextFields {
  const href = card.is("a")
    ? card.attr("href")
    : card.find("a[href]").attr("href");
  const image = card.find("img").first();
  const textParts = card
    .find("h1,h2,h3,h4,p,span")
    .toArray()
    .map((node) => normalizeWhitespace($(node).text()))
    .filter(Boolean);
  const heading = normalizeWhitespace(card.find("h1,h2,h3,h4").first().text());
  const imageAlt = normalizeWhitespace(image.attr("alt") ?? "");
  const price = textParts.find((text) => PRICE_PATTERN.test(text)) ?? null;
  const name =
    heading || imageAlt || textParts.find((text) => text !== price) || null;
  const nonPriceParts = textParts.filter(
    (text) => text !== price && text !== name,
  );
  const collection = nonPriceParts[0] ?? null;
  const description = nonPriceParts[1] ?? nonPriceParts[0] ?? null;

  return {
    name,
    url: absoluteUrl(href, pageUrl),
    imageUrl: absoluteUrl(image.attr("src"), pageUrl),
    description,
    collection,
    price,
  };
}

function looksLikeProduct(fields: ProductFields): boolean {
  return Boolean(
    fields.url?.includes("/products/") || (fields.name && fields.imageUrl),
  );
}

function stableProductId(fields: ProductFields): string {
  if (fields.url) {
    const pathname = new URL(fields.url).pathname;
    return `url-${slugify(pathname)}`;
  }

  const contentIdSource = stableContentIdSource(fields);

  if (contentIdSource) {
    return `content-${slugify(contentIdSource)}`;
  }

  return `hash-${hash(stableJson(fields)).slice(0, 16)}`;
}

function stableContentIdSource(fields: ProductFields): string | null {
  if (fields.name || fields.imageUrl) {
    return [fields.name, fields.imageUrl].filter(Boolean).join(" ");
  }

  return fields.description;
}

function buildDiscoveredProduct(
  fields: ProductFields,
  options: ProductExtractionOptions,
): DiscoveredProduct {
  const stableId = stableProductId(fields);
  const normalizedSnapshot = normalizeSnapshot(stableId, fields, options);

  return {
    stableId,
    ...fields,
    sourcePageUrl: options.pageUrl,
    normalizedSnapshot,
    rawFingerprint: fingerprintSnapshot(normalizedSnapshot),
  };
}

function normalizeSnapshot(
  stableId: string,
  fields: ProductFields,
  options: ProductExtractionOptions,
): JsonObject {
  return {
    stableId,
    name: fields.name,
    url: fields.url,
    sourcePageUrl: options.pageUrl,
    imageUrl: fields.imageUrl,
    description: fields.description,
    collection: fields.collection,
    price: fields.price,
    candidateSignals: candidateSignals(fields.candidateEvidence),
    cardEvidence: fields.candidateEvidence,
    observedAt: options.observedAt,
  };
}

function fingerprintSnapshot(snapshot: JsonObject): string {
  const { observedAt: _observedAt, ...stableSnapshot } = snapshot;

  return hash(stableJson(stableSnapshot));
}

function candidateEvidence(
  $: cheerio.CheerioAPI,
  card: CheerioSelection,
): CandidateEvidence[] {
  const classValue = [
    card.attr("class"),
    ...card
      .find("[class]")
      .toArray()
      .map((node) => $(node).attr("class")),
  ]
    .filter(Boolean)
    .join(" ");
  const normalizedClassValue = classValue.toLowerCase();
  const signals = new Set<string>();

  const hasAnimateWiggle = /\banimate[-_:]?wiggle\b/.test(normalizedClassValue);

  if (hasAnimateWiggle) {
    signals.add("animate-wiggle");
  }

  if (
    !hasAnimateWiggle &&
    /\bwiggle(?:[-_:]?\w+)?\b/.test(normalizedClassValue)
  ) {
    signals.add("wiggle");
  }

  return Array.from(signals).map((signal) => ({
    signal,
    source: "class",
    value: classValue,
  }));
}

function mergeProducts(
  existing: DiscoveredProduct,
  incoming: DiscoveredProduct,
): DiscoveredProduct {
  const candidateEvidence = [
    ...existing.candidateEvidence,
    ...incoming.candidateEvidence.filter(
      (evidence) =>
        !existing.candidateEvidence.some(
          (existingEvidence) =>
            existingEvidence.signal === evidence.signal &&
            existingEvidence.value === evidence.value,
        ),
    ),
  ];
  const merged = {
    ...incoming,
    candidateEvidence,
  };
  const normalizedSnapshot = {
    ...incoming.normalizedSnapshot,
    candidateSignals: candidateSignals(candidateEvidence),
    cardEvidence: candidateEvidence,
  };

  return {
    ...merged,
    normalizedSnapshot,
    rawFingerprint: fingerprintSnapshot(normalizedSnapshot),
  };
}

function candidateSignals(evidence: CandidateEvidence[]): string[] {
  return evidence.map((item) => item.signal);
}

function absoluteUrl(
  value: string | undefined,
  baseUrl: string,
): string | null {
  if (!value) {
    return null;
  }

  return new URL(value, baseUrl).toString();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

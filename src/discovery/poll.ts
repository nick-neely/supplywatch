import { chromium } from "playwright";
import {
  type DiscoveredProduct,
  extractProductCardsFromHtml,
} from "./products.js";

export type ProductDiscoveryPollOptions = {
  targetUrl: string;
  observationWindowMs: number;
  fullSweep?: boolean;
};

export type ProductDiscoveryPollResult = {
  products: DiscoveredProduct[];
  observedWindowMs: number;
};

export type RenderedProductPage = {
  url: () => string;
  content: () => Promise<string>;
  waitForTimeout: (milliseconds: number) => Promise<void>;
};

export type RenderedProductObservationOptions = {
  observationWindowMs: number;
  now?: () => number;
  observedAt?: () => string;
};

export async function pollRenderedSupplyPage(
  options: ProductDiscoveryPollOptions,
): Promise<ProductDiscoveryPollResult> {
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    await page.goto(options.targetUrl, { waitUntil: "networkidle" });

    return await observeRenderedProductCards(page, {
      observationWindowMs: options.observationWindowMs,
    });
  } finally {
    await browser.close();
  }
}

export async function observeRenderedProductCards(
  page: RenderedProductPage,
  options: RenderedProductObservationOptions,
): Promise<ProductDiscoveryPollResult> {
  const now = options.now ?? Date.now;
  const observedAt = options.observedAt ?? (() => new Date().toISOString());
  const products = new Map<string, DiscoveredProduct>();
  const deadline = now() + options.observationWindowMs;

  do {
    const html = await page.content();

    for (const product of extractProductCardsFromHtml(html, {
      pageUrl: page.url(),
      observedAt: observedAt(),
    })) {
      products.set(product.stableId, product);
    }

    if (now() < deadline) {
      await page.waitForTimeout(Math.min(500, Math.max(0, deadline - now())));
    }
  } while (now() < deadline);

  return {
    products: Array.from(products.values()),
    observedWindowMs: options.observationWindowMs,
  };
}

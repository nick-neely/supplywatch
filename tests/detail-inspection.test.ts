import { describe, expect, it, vi } from "vitest";
import {
  inspectProductDetail,
  inspectProductDetailHtml,
} from "../src/detail/inspection.js";
import type { DiscoveredProduct } from "../src/discovery/products.js";
import { loadProductStateFixture } from "../src/fixtures/load.js";

const PRODUCT: DiscoveredProduct = {
  stableId: "url-products-sold-through-hoodie",
  name: "Sold Through Hoodie",
  url: "https://supplyco.openai.com/products/sold-through-hoodie",
  imageUrl: "https://cdn.example/sold-through-hoodie.png",
  description: "A product card discovered on the collection page",
  collection: "Apparel",
  price: "$48",
  candidateEvidence: [],
  normalizedSnapshot: {
    stableId: "url-products-sold-through-hoodie",
    name: "Sold Through Hoodie",
    url: "https://supplyco.openai.com/products/sold-through-hoodie",
  },
  rawFingerprint: "card-fingerprint",
};

describe("detail inspection", () => {
  it("opens a product URL and classifies out-of-stock detail state", async () => {
    const fixture = await loadProductStateFixture("out-of-stock");
    const page = {
      url: () => "https://supplyco.openai.com/collections/all",
      goto: vi.fn().mockResolvedValue(undefined),
      content: vi.fn().mockResolvedValue(fixture.html),
      click: vi.fn(),
    };

    const result = await inspectProductDetail(page, PRODUCT);

    expect(page.goto).toHaveBeenCalledWith(PRODUCT.url, {
      waitUntil: "networkidle",
    });
    expect(result).toMatchObject({
      stableId: PRODUCT.stableId,
      productUrl: PRODUCT.url,
      buyable: false,
      confidence: "high",
      availableSizes: [],
      disabledSizes: [],
      actionEvidence: [
        {
          label: "Out of stock",
          disabled: true,
        },
      ],
    });
    expect(result.detailText).toContain("Sold Through Hoodie");
    expect(result.detectors).toContainEqual(
      expect.objectContaining({
        name: "unavailable-text",
        matched: true,
      }),
    );
  });

  it.each([
    ["purchase-button", true, "high", [], []],
    ["sizeless", true, "high", [], []],
    ["employee-gated-login", false, "high", [], []],
    ["disabled-size", false, "high", [], ["M"]],
    ["enabled-size", true, "high", ["M"], []],
    ["sized", true, "high", ["M"], []],
  ] as const)("extracts and classifies %s detail evidence", async (state, buyable, confidence, availableSizes, disabledSizes) => {
    const fixture = await loadProductStateFixture(state);
    const result = inspectProductDetailHtml(fixture.html, PRODUCT);

    expect(result).toMatchObject({
      buyable,
      confidence,
      availableSizes,
      disabledSizes,
    });
    expect(result.actionEvidence.length).toBeGreaterThan(0);
    expect(result.detailText).not.toBe("");
  });

  it("inspects detail evidence even when a discovered product has no stable URL", async () => {
    const fixture = await loadProductStateFixture("sizeless");
    const productWithoutUrl = {
      ...PRODUCT,
      stableId: "content-sizeless-product",
      url: null,
      normalizedSnapshot: {
        stableId: "content-sizeless-product",
        name: "Sizeless Product",
      },
    };
    const page = {
      url: () => "https://supplyco.openai.com/collections/all",
      goto: vi.fn(),
      content: vi.fn().mockResolvedValue(fixture.html),
      click: vi.fn(),
    };

    const result = await inspectProductDetail(page, productWithoutUrl);

    expect(page.goto).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      stableId: "content-sizeless-product",
      productUrl: null,
      buyable: true,
      availableSizes: [],
    });
    expect(result.detailText).toContain("Sizeless Product");
  });

  it("tries enabled size controls when purchase evidence appears after variant selection", async () => {
    const beforeSelection = `
      <main>
        <h1>Variant Tee</h1>
        <button type="button" data-size="M">M</button>
        <button type="button" disabled>Select a size</button>
      </main>
    `;
    const afterSelection = `
      <main>
        <h1>Variant Tee</h1>
        <button type="button" data-size="M">M</button>
        <button type="button">Add to cart</button>
      </main>
    `;
    const page = {
      url: () => "https://supplyco.openai.com/collections/all",
      goto: vi.fn().mockResolvedValue(undefined),
      content: vi
        .fn()
        .mockResolvedValueOnce(beforeSelection)
        .mockResolvedValueOnce(afterSelection),
      click: vi.fn().mockResolvedValue(undefined),
    };

    const result = await inspectProductDetail(page, PRODUCT);

    expect(page.click).toHaveBeenCalledWith("[data-size='M']");
    expect(result).toMatchObject({
      buyable: true,
      availableSizes: ["M"],
      actionEvidence: [
        {
          label: "M",
          disabled: false,
        },
        {
          label: "Add to cart",
          disabled: false,
        },
      ],
    });
  });
});

import { describe, expect, it } from "vitest";
import { extractProductCardsFromHtml } from "../src/discovery/products.js";

describe("product discovery", () => {
  it("normalizes product card fields, candidate evidence, stable IDs, and fingerprints", () => {
    const html = `
      <main>
        <a class="group animate-wiggle" href="/products/public-drop-tee">
          <img src="https://cdn.example/public-drop-tee.png" alt="Public Drop Tee">
          <p>Apparel</p>
          <h2>Public Drop Tee</h2>
          <p>Soft launch shirt</p>
          <span>$28</span>
        </a>
      </main>
    `;

    const [product] = extractProductCardsFromHtml(html, {
      pageUrl: "https://supplyco.openai.com/collections/all?cacheBust=1",
      observedAt: "2026-06-04T15:00:00.000Z",
    });

    expect(product).toMatchObject({
      stableId: "url-products-public-drop-tee",
      name: "Public Drop Tee",
      url: "https://supplyco.openai.com/products/public-drop-tee",
      imageUrl: "https://cdn.example/public-drop-tee.png",
      description: "Soft launch shirt",
      collection: "Apparel",
      price: "$28",
      candidateEvidence: [
        {
          signal: "animate-wiggle",
          source: "class",
          value: "group animate-wiggle",
        },
      ],
    });
    expect(product.normalizedSnapshot).toMatchObject({
      stableId: "url-products-public-drop-tee",
      candidateSignals: ["animate-wiggle"],
    });
    expect(product.rawFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("keeps fingerprints stable across volatile observation timestamps", () => {
    const html = `
      <a href="/products/public-drop-tee">
        <h2>Public Drop Tee</h2>
        <img src="/cdn/public-drop-tee.png" alt="">
      </a>
    `;

    const [first] = extractProductCardsFromHtml(html, {
      pageUrl: "https://supplyco.openai.com",
      observedAt: "2026-06-04T15:00:00.000Z",
    });
    const [second] = extractProductCardsFromHtml(html, {
      pageUrl: "https://supplyco.openai.com",
      observedAt: "2026-06-04T15:05:00.000Z",
    });

    expect(first.rawFingerprint).toBe(second.rawFingerprint);
    expect(first.normalizedSnapshot.observedAt).toBe(
      "2026-06-04T15:00:00.000Z",
    );
    expect(second.normalizedSnapshot.observedAt).toBe(
      "2026-06-04T15:05:00.000Z",
    );
  });

  it("falls back to stable content fields when a card has no product URL", () => {
    const html = `
      <article class="supply-card wiggle-animation">
        <h3>Desk Plate</h3>
        <img src="https://cdn.example/desk-plate.png" alt="Desk Plate">
        <p>Serialized metal desk object</p>
      </article>
    `;

    const [product] = extractProductCardsFromHtml(html, {
      pageUrl: "https://supplyco.openai.com",
      observedAt: "2026-06-04T15:00:00.000Z",
    });

    expect(product.stableId).toBe(
      "content-desk-plate-https-cdn-example-desk-plate-png",
    );
    expect(product.candidateEvidence).toContainEqual(
      expect.objectContaining({
        signal: "wiggle",
      }),
    );
  });
});

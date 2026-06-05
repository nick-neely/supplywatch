// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  App,
  type ProductDetailFetcher,
  type ProductListFetcher,
  type SummaryFetcher,
} from "./App.js";

const roots: Array<{ unmount: () => void }> = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount());
  }
  document.body.innerHTML = "";
  window.history.pushState({}, "", "/");
});

describe("Watcher dashboard app", () => {
  it("renders the summary and refreshes it on demand", async () => {
    window.history.pushState({}, "", "/summary");
    const fetchSummary = vi
      .fn<SummaryFetcher>()
      .mockResolvedValueOnce({
        generatedAt: "2026-06-04T15:00:00.000Z",
        latestRun: {
          id: 1,
          startedAt: "2026-06-04T14:59:00.000Z",
          finishedAt: null,
          status: "running",
          productCount: 0,
          errorMessage: null,
        },
        staleRunningRun: null,
        notifications: { pending: 1, failed: 0 },
        healthEvents: { total: 0, byType: [] },
      })
      .mockResolvedValueOnce({
        generatedAt: "2026-06-04T15:01:00.000Z",
        latestRun: {
          id: 1,
          startedAt: "2026-06-04T14:59:00.000Z",
          finishedAt: "2026-06-04T15:00:20.000Z",
          status: "completed",
          productCount: 7,
          errorMessage: null,
        },
        staleRunningRun: null,
        notifications: { pending: 0, failed: 0 },
        healthEvents: { total: 0, byType: [] },
      });

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(<App fetchSummary={fetchSummary} refreshIntervalMs={0} />);
    });

    expect(await screenText("running")).toBeTruthy();
    expect(container.textContent).toContain("Pending notifications");
    expect(container.textContent).toContain("1");

    await act(async () => {
      clickButton(container, "Refresh summary");
    });

    expect(fetchSummary).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("completed");
    expect(container.textContent).toContain("7");
    expect(container.textContent).toContain("15:01:00");
  });

  it("renders Products from URL-backed table state and preserves filter changes in the URL", async () => {
    window.history.pushState(
      {},
      "",
      "/products?search=logo&availability=publicly_buyable&watchStatus=active&page=2&pageSize=25&sort=name.asc",
    );
    const fetchProducts = vi.fn<ProductListFetcher>().mockResolvedValue({
      products: [
        {
          stableId: "tee-url",
          name: "OpenAI Logo Tee",
          url: "https://example.com/products/tee",
          imageUrl: null,
          collection: "Apparel",
          price: "$42",
          availabilityState: "publicly_buyable",
          availableSizes: ["M", "L"],
          firstSeenAt: "2026-06-04T12:00:00.000Z",
          lastSeenAt: "2026-06-04T15:00:00.000Z",
          firstPublicAt: "2026-06-04T15:00:00.000Z",
          isRetired: false,
          retiredAt: null,
          retirementReason: null,
          outOfStockConfirmations: 0,
          overrideBadges: ["force watched"],
        },
      ],
      page: 2,
      pageSize: 25,
      total: 26,
      totalPages: 2,
    });

    const container = renderApp(
      <App
        fetchProducts={fetchProducts}
        fetchSummary={idleSummary}
        refreshIntervalMs={0}
      />,
    );

    await waitForText("OpenAI Logo Tee");

    expect(fetchProducts).toHaveBeenLastCalledWith(
      expect.objectContaining({
        search: "logo",
        availabilityStates: ["publicly_buyable"],
        watchStatus: "active",
        page: 2,
        pageSize: 25,
        sort: { field: "name", direction: "asc" },
      }),
    );
    expect(container.textContent).toContain("force watched");

    const searchInput = container.querySelector<HTMLInputElement>(
      'input[name="product-search"]',
    );
    if (!searchInput) {
      throw new Error("Missing Product search input");
    }

    await act(async () => {
      searchInput.value = "hat";
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(window.location.pathname).toBe("/products");
    expect(window.location.search).toContain("search=hat");
    expect(window.location.search).toContain("page=1");
  });

  it("renders Product detail with image fallback and collapsible snapshot evidence", async () => {
    window.history.pushState({}, "", "/products/tee-detail");
    const fetchProductDetail = vi.fn<ProductDetailFetcher>().mockResolvedValue({
      stableId: "tee-detail",
      name: "OpenAI Logo Tee",
      url: "https://example.com/products/tee",
      sourceUrl: "https://example.com/products/tee",
      imageUrl: null,
      description: "A persisted tee.",
      collection: "Apparel",
      price: "$42",
      availabilityState: "publicly_buyable",
      availableSizes: ["M"],
      firstSeenAt: "2026-06-04T12:00:00.000Z",
      lastSeenAt: "2026-06-04T15:00:00.000Z",
      firstPublicAt: "2026-06-04T15:00:00.000Z",
      isRetired: false,
      retiredAt: null,
      retirementReason: null,
      outOfStockConfirmations: 0,
      overrideBadges: ["known employee only"],
      normalizedSnapshot: { title: "OpenAI Logo Tee" },
      rawFingerprint: "fingerprint:tee-detail",
      override: {
        productId: "tee-detail",
        denylisted: false,
        forceRetired: false,
        forceWatched: false,
        knownEmployeeOnly: true,
        annotation: "staff gate context",
      },
      recentEvents: [
        {
          id: 1,
          eventType: "product_publicly_buyable",
          payload: { alertKind: "product" },
          notificationStatus: "sent",
          attemptCount: 1,
          lastAttemptAt: null,
          notificationError: null,
          createdAt: "2026-06-04T15:00:00.000Z",
          notifiedAt: "2026-06-04T15:00:05.000Z",
        },
      ],
    });

    const container = renderApp(
      <App
        fetchProductDetail={fetchProductDetail}
        fetchSummary={idleSummary}
        refreshIntervalMs={0}
      />,
    );

    await waitForText("Image unavailable");

    expect(container.textContent).toContain("staff gate context");
    expect(container.textContent).toContain("product_publicly_buyable");
    expect(container.textContent).not.toContain("fingerprint:tee-detail");

    await act(async () => {
      clickButton(container, "Snapshot and fingerprint");
    });

    expect(container.textContent).toContain("fingerprint:tee-detail");
  });
});

const idleSummary: SummaryFetcher = () => new Promise(() => {});

function renderApp(element: ReactNode): HTMLElement {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);

  act(() => {
    root.render(element);
  });

  return container;
}

async function waitForText(text: string): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (document.body.textContent?.includes(text)) {
      return;
    }
  }

  throw new Error(`Timed out waiting for text: ${text}`);
}

async function screenText(text: string): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  return document.body.textContent?.includes(text) ?? false;
}

function clickButton(container: HTMLElement, name: string): void {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === name,
  );

  if (!button) {
    throw new Error(`Could not find button: ${name}`);
  }

  button.click();
}

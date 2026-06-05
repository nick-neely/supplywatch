// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatTimestamp } from "@/lib/format-timestamp";
import {
  App,
  type EventDetailFetcher,
  type EventsFetcher,
  type ProductDetailFetcher,
  type ProductListFetcher,
  type SummaryFetcher,
} from "./App.js";

const roots: Array<{ unmount: () => void }> = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount());
  }
  vi.useRealTimers();
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
    expect(container.textContent).toContain(
      formatTimestamp("2026-06-04T15:01:00.000Z"),
    );
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

  it("auto-refreshes Products on the configured dashboard interval", async () => {
    vi.useFakeTimers();
    window.history.pushState({}, "", "/products");
    const fetchProducts = vi
      .fn<ProductListFetcher>()
      .mockResolvedValueOnce({
        products: [
          {
            stableId: "tee-auto",
            name: "OpenAI Logo Tee",
            url: "https://example.com/products/tee",
            imageUrl: null,
            collection: "Apparel",
            price: "$42",
            availabilityState: "out_of_stock",
            availableSizes: [],
            firstSeenAt: "2026-06-04T12:00:00.000Z",
            lastSeenAt: "2026-06-04T15:00:00.000Z",
            firstPublicAt: null,
            isRetired: false,
            retiredAt: null,
            retirementReason: null,
            outOfStockConfirmations: 1,
            overrideBadges: [],
          },
        ],
        page: 1,
        pageSize: 50,
        total: 1,
        totalPages: 1,
      })
      .mockResolvedValueOnce({
        products: [
          {
            stableId: "hat-auto",
            name: "OpenAI Logo Hat",
            url: "https://example.com/products/hat",
            imageUrl: null,
            collection: "Apparel",
            price: "$35",
            availabilityState: "publicly_buyable",
            availableSizes: ["OS"],
            firstSeenAt: "2026-06-04T12:00:00.000Z",
            lastSeenAt: "2026-06-04T15:01:00.000Z",
            firstPublicAt: "2026-06-04T15:01:00.000Z",
            isRetired: false,
            retiredAt: null,
            retirementReason: null,
            outOfStockConfirmations: 0,
            overrideBadges: [],
          },
        ],
        page: 1,
        pageSize: 50,
        total: 1,
        totalPages: 1,
      });

    renderApp(
      <App
        fetchProducts={fetchProducts}
        fetchSummary={idleSummary}
        refreshIntervalMs={1_000}
      />,
    );

    await flushReact();
    expect(document.body.textContent).toContain("OpenAI Logo Tee");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    await flushReact();
    expect(document.body.textContent).toContain("OpenAI Logo Hat");
    expect(fetchProducts).toHaveBeenCalledTimes(2);
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
      clickButton(container, "Show evidence");
    });

    expect(container.textContent).toContain("fingerprint:tee-detail");
  });

  it("renders Events from URL-backed table state with Product links", async () => {
    window.history.pushState(
      {},
      "",
      "/events?eventType=candidate_signal_detected&notificationStatus=failed&productId=tee-event&page=2&pageSize=25&sort=createdAt&direction=asc",
    );
    const fetchEvents = vi.fn<EventsFetcher>().mockResolvedValue({
      events: [
        {
          id: 12,
          eventType: "candidate_signal_detected",
          productId: "tee-event",
          productName: "OpenAI Logo Tee",
          notificationStatus: "failed",
          attemptCount: 2,
          lastAttemptAt: "2026-06-04T15:01:00.000Z",
          createdAt: "2026-06-04T15:00:00.000Z",
          notifiedAt: null,
          hasPayload: true,
          hasNotificationError: true,
        },
      ],
      pagination: {
        page: 2,
        pageSize: 25,
        totalItems: 26,
        totalPages: 2,
      },
    });

    const container = renderApp(
      <App
        fetchEvents={fetchEvents}
        fetchSummary={idleSummary}
        refreshIntervalMs={0}
      />,
    );

    await waitForText("candidate_signal_detected");

    expect(fetchEvents).toHaveBeenLastCalledWith({
      eventType: "candidate_signal_detected",
      notificationStatus: "failed",
      productId: "tee-event",
      sortBy: "createdAt",
      sortDirection: "asc",
      page: 2,
      pageSize: 25,
    });
    expect(container.textContent).toContain("Candidate evidence");
    expect(
      container.querySelector<HTMLAnchorElement>(
        'a[href="/products/tee-event"]',
      )?.textContent,
    ).toBe("OpenAI Logo Tee");

    const eventTypeInput = container.querySelector<HTMLInputElement>(
      'input[name="event-type"]',
    );
    if (!eventTypeInput) {
      throw new Error("Missing Event type input");
    }

    await act(async () => {
      eventTypeInput.value = "product_publicly_buyable";
      eventTypeInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(window.location.pathname).toBe("/events");
    expect(window.location.search).toContain(
      "eventType=product_publicly_buyable",
    );
    expect(window.location.search).toContain("page=1");
  });

  it("renders Event detail with payload JSON, notification error, and Product link", async () => {
    window.history.pushState({}, "", "/events/12");
    const fetchEventDetail = vi.fn<EventDetailFetcher>().mockResolvedValue({
      id: 12,
      eventType: "candidate_signal_detected",
      productId: "tee-event",
      productName: "OpenAI Logo Tee",
      payload: { signal: "animate-wiggle", evidenceOnly: true },
      notificationStatus: "failed",
      attemptCount: 2,
      lastAttemptAt: "2026-06-04T15:01:00.000Z",
      notificationError: "Discord webhook failed",
      createdAt: "2026-06-04T15:00:00.000Z",
      notifiedAt: null,
      hasPayload: true,
      hasNotificationError: true,
    });

    const container = renderApp(
      <App
        fetchEventDetail={fetchEventDetail}
        fetchSummary={idleSummary}
        refreshIntervalMs={0}
      />,
    );

    await waitForText("Event #12");

    expect(container.textContent).toContain("Candidate evidence");
    expect(container.textContent).toContain("Discord webhook failed");
    expect(container.textContent).toContain('"signal": "animate-wiggle"');
    expect(
      container.querySelector<HTMLAnchorElement>(
        'a[href="/products/tee-event"]',
      )?.textContent,
    ).toBe("OpenAI Logo Tee");
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

async function flushReact(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

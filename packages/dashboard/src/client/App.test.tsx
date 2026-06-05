// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  App,
  type RunDetailFetcher,
  type RunsFetcher,
  type SummaryFetcher,
} from "./App.js";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<{ unmount: () => void }> = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount());
  }
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

describe("Watcher dashboard app", () => {
  it("renders the summary and refreshes it on demand", async () => {
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

  it("keeps Runs table state in the URL and asks the server for that slice", async () => {
    window.history.replaceState(
      null,
      "",
      "/runs?sort=startedAt&direction=desc&page=2&pageSize=10",
    );
    const fetchRuns = vi.fn<RunsFetcher>().mockResolvedValue({
      runs: [
        {
          id: 12,
          startedAt: "2026-06-04T15:05:00.000Z",
          finishedAt: null,
          status: "running",
          productCount: 0,
          errorMessage: null,
          durationMs: null,
          hasError: false,
          staleRunning: {
            startedAt: "2026-06-04T15:05:00.000Z",
            minutesSinceStart: 40,
          },
        },
      ],
      pagination: {
        page: 2,
        pageSize: 10,
        totalItems: 12,
        totalPages: 2,
      },
    });

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <App
          fetchRuns={fetchRuns}
          fetchSummary={vi.fn<SummaryFetcher>()}
          refreshIntervalMs={0}
        />,
      );
    });

    expect(fetchRuns).toHaveBeenLastCalledWith({
      sortBy: "startedAt",
      sortDirection: "desc",
      page: 2,
      pageSize: 10,
      status: undefined,
    });
    expect(await screenText("Stale-looking, 40m")).toBeTruthy();

    await act(async () => {
      changeSelect(container, "Run status", "failed");
    });

    expect(window.location.pathname).toBe("/runs");
    expect(window.location.search).toContain("status=failed");
    expect(window.location.search).toContain("page=1");
    expect(fetchRuns).toHaveBeenLastCalledWith({
      sortBy: "startedAt",
      sortDirection: "desc",
      page: 1,
      pageSize: 10,
      status: "failed",
    });
  });

  it("renders lightweight Run detail with full persisted error text", async () => {
    window.history.replaceState(null, "", "/runs/7");
    const fetchRunDetail = vi.fn<RunDetailFetcher>().mockResolvedValue({
      id: 7,
      startedAt: "2026-06-04T15:00:00.000Z",
      finishedAt: "2026-06-04T15:00:10.000Z",
      status: "failed",
      productCount: 4,
      errorMessage: "detail inspection timed out after modal open",
      durationMs: 10_000,
      hasError: true,
      staleRunning: null,
    });

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <App
          fetchRunDetail={fetchRunDetail}
          fetchSummary={vi.fn<SummaryFetcher>()}
          refreshIntervalMs={0}
        />,
      );
    });

    expect(fetchRunDetail).toHaveBeenCalledWith(7);
    expect(await screenText("Run #7")).toBeTruthy();
    expect(container.textContent).toContain(
      "detail inspection timed out after modal open",
    );
    expect(container.textContent).toContain("10s");
  });
});

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

function changeSelect(
  container: HTMLElement,
  label: string,
  value: string,
): void {
  const select = Array.from(container.querySelectorAll("select")).find(
    (candidate) => candidate.getAttribute("aria-label") === label,
  );

  if (!select) {
    throw new Error(`Could not find select: ${label}`);
  }

  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

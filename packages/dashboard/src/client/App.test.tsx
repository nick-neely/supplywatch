// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App, type SummaryFetcher } from "./App.js";

const roots: Array<{ unmount: () => void }> = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount());
  }
  document.body.innerHTML = "";
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

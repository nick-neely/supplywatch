import { describe, expect, it, vi } from "vitest";
import { observeRenderedProductCards } from "../src/discovery/poll.js";

describe("rendered product observation", () => {
  it("rescans the rendered page during the observation window", async () => {
    let now = 0;
    const page = {
      url: () => "https://supplyco.openai.com",
      content: vi
        .fn()
        .mockResolvedValueOnce(`
          <a href="/products/quiet-tee">
            <h2>Quiet Tee</h2>
            <img src="/quiet-tee.png" alt="">
          </a>
        `)
        .mockResolvedValueOnce(`
          <a class="animate-wiggle" href="/products/quiet-tee">
            <h2>Quiet Tee</h2>
            <img src="/quiet-tee.png" alt="">
          </a>
        `),
      waitForTimeout: vi.fn().mockImplementation(async (ms: number) => {
        now += ms;
      }),
    };

    const result = await observeRenderedProductCards(page, {
      observationWindowMs: 1_000,
      now: () => now,
      observedAt: () => "2026-06-04T15:00:00.000Z",
    });

    expect(page.content).toHaveBeenCalledTimes(2);
    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.candidateEvidence).toContainEqual(
      expect.objectContaining({
        signal: "animate-wiggle",
      }),
    );
  });
});

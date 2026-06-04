import { describe, expect, it } from "vitest";
import { classifyAvailability } from "../src/availability/classifier.js";
import { detectAvailabilitySignals } from "../src/availability/detectors.js";
import { loadProductStateFixture } from "../src/fixtures/load.js";

describe("availability classification", () => {
  it("treats animate-wiggle as candidate evidence only", async () => {
    const fixture = await loadProductStateFixture("animate-wiggle-candidate");
    const detectors = detectAvailabilitySignals(fixture.html);

    expect(classifyAvailability(detectors)).toMatchObject({
      buyable: false,
      confidence: "low",
    });
    expect(detectors).toContainEqual(
      expect.objectContaining({
        name: "animate-wiggle",
        matched: true,
      }),
    );
  });

  it.each([
    "purchase-button",
    "sizeless",
  ] as const)("treats %s public purchase controls as buyable", async (state) => {
    const fixture = await loadProductStateFixture(state);
    const result = classifyAvailability(
      detectAvailabilitySignals(fixture.html),
    );

    expect(result).toMatchObject({
      buyable: true,
      confidence: "high",
    });
    expect(result.detectors).toContainEqual(
      expect.objectContaining({
        name: "enabled-public-purchase-control",
        matched: true,
      }),
    );
    expect(result.verificationBoundary).toContain("must not automate checkout");
  });

  it.each([
    "enabled-size",
    "sized",
  ] as const)("treats %s purchase controls as buyable", async (state) => {
    const fixture = await loadProductStateFixture(state);
    const result = classifyAvailability(
      detectAvailabilitySignals(fixture.html),
    );

    expect(result).toMatchObject({
      buyable: true,
      confidence: "high",
    });
    expect(result.detectors).toContainEqual(
      expect.objectContaining({
        name: "enabled-size",
        matched: true,
        polarity: "positive",
      }),
    );
  });

  it("does not treat an enabled size alone as publicly buyable", () => {
    const result = classifyAvailability(
      detectAvailabilitySignals(`
        <main>
          <h1>Variant Tee</h1>
          <button type="button" data-size="M">M</button>
          <button type="button" disabled>Select a size</button>
        </main>
      `),
    );

    expect(result).toMatchObject({
      buyable: false,
      confidence: "medium",
    });
    expect(result.detectors).toContainEqual(
      expect.objectContaining({
        name: "enabled-size",
        matched: true,
      }),
    );
  });

  it("prefers negative detail evidence over candidate animation", async () => {
    const fixture = await loadProductStateFixture("out-of-stock");
    const result = classifyAvailability(
      detectAvailabilitySignals(
        fixture.html.replace("<main>", '<main class="animate-wiggle">'),
      ),
    );

    expect(result).toMatchObject({
      buyable: false,
      confidence: "high",
    });
    expect(result.detectors).toContainEqual(
      expect.objectContaining({
        name: "animate-wiggle",
        matched: true,
      }),
    );
    expect(result.detectors).toContainEqual(
      expect.objectContaining({
        name: "unavailable-text",
        matched: true,
        polarity: "negative",
      }),
    );
  });

  it.each([
    "out-of-stock",
    "employee-gated-login",
    "disabled-size",
  ] as const)("treats %s detail states as not buyable", async (state) => {
    const fixture = await loadProductStateFixture(state);
    const result = classifyAvailability(
      detectAvailabilitySignals(fixture.html),
    );

    expect(result).toMatchObject({
      buyable: false,
      confidence: "high",
    });
    expect(result.detectors).toContainEqual(
      expect.objectContaining({
        matched: true,
        polarity: "negative",
      }),
    );
  });
});

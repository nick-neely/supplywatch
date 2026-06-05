import { describe, expect, it } from "vitest";
import {
  formatTableTimestamp,
  formatTimestamp,
  formatTimestampTitle,
} from "./format-timestamp";

describe("formatTimestamp", () => {
  it("returns none for empty values", () => {
    expect(formatTimestamp(null)).toBe("none");
    expect(formatTimestamp(undefined)).toBe("none");
  });

  it("formats ISO timestamps with locale-aware output", () => {
    const formatted = formatTimestamp("2026-06-04T15:00:00.000Z");

    expect(formatted).not.toBe("none");
    expect(formatted).toMatch(/2026/);
    expect(formatted).toMatch(/Jun|6/);
  });

  it("returns the raw value when parsing fails", () => {
    expect(formatTimestamp("not-a-date")).toBe("not-a-date");
  });
});

describe("formatTableTimestamp", () => {
  it("returns none for empty values", () => {
    expect(formatTableTimestamp(null)).toBe("none");
  });

  it("omits time and timezone from the display value", () => {
    const formatted = formatTableTimestamp("2026-06-04T15:00:00.000Z");
    const full = formatTimestamp("2026-06-04T15:00:00.000Z");

    expect(formatted).toMatch(/2026/);
    expect(formatted.length).toBeLessThan(full.length);
    expect(formatted).not.toMatch(/CDT|UTC|PM|AM/i);
  });
});

describe("formatTimestampTitle", () => {
  it("returns the full locale timestamp for hover text", () => {
    expect(formatTimestampTitle("2026-06-04T15:00:00.000Z")).toBe(
      formatTimestamp("2026-06-04T15:00:00.000Z"),
    );
  });
});

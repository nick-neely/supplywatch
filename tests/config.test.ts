import { describe, expect, it } from "vitest";
import {
  parseConfig,
  redactConfig,
  type SupplywatchConfig,
} from "../src/config/env.js";

describe("parseConfig", () => {
  it("defaults to dry-run watcher settings", () => {
    expect(parseConfig({})).toEqual({
      SUPPLYWATCH_TARGET_URL: "https://supplyco.openai.com",
      DATABASE_PATH: "./data/supplywatch.sqlite",
      DRY_RUN: true,
      DISCORD_WEBHOOK_URL: undefined,
      POLL_INTERVAL_SECONDS: 60,
      OBSERVATION_WINDOW_SECONDS: 15,
      FULL_SWEEP_INTERVAL_MINUTES: 60,
      OUT_OF_STOCK_RETIRE_CONFIRMATIONS: 3,
      NOTIFY_MAX_ATTEMPTS: 10,
    });
  });

  it("requires a Discord webhook when dry-run mode is disabled", () => {
    expect(() =>
      parseConfig({
        DRY_RUN: "false",
        DISCORD_WEBHOOK_URL: "",
      }),
    ).toThrow(/DISCORD_WEBHOOK_URL is required/);
  });
});

describe("redactConfig", () => {
  it("redacts Discord webhook URLs", () => {
    const config = {
      SUPPLYWATCH_TARGET_URL: "https://supplyco.openai.com",
      DATABASE_PATH: "./data/supplywatch.sqlite",
      DRY_RUN: false,
      DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/example",
      POLL_INTERVAL_SECONDS: 60,
      OBSERVATION_WINDOW_SECONDS: 15,
      FULL_SWEEP_INTERVAL_MINUTES: 60,
      OUT_OF_STOCK_RETIRE_CONFIRMATIONS: 3,
      NOTIFY_MAX_ATTEMPTS: 10,
    } satisfies SupplywatchConfig;

    expect(redactConfig(config).DISCORD_WEBHOOK_URL).toBe("[redacted]");
  });
});

import "dotenv/config";
import { z } from "zod";

const booleanFromString = z
  .string()
  .optional()
  .default("true")
  .transform((value) => value.toLowerCase() === "true");

const positiveIntegerFromString = (defaultValue: number) =>
  z
    .string()
    .optional()
    .default(String(defaultValue))
    .transform((value, context) => {
      const parsed = Number.parseInt(value, 10);

      if (!Number.isInteger(parsed) || parsed <= 0) {
        context.addIssue({
          code: "custom",
          message: "Expected a positive integer",
        });
        return z.NEVER;
      }

      return parsed;
    });

const envSchema = z
  .object({
    SUPPLYWATCH_TARGET_URL: z.url().default("https://supplyco.openai.com"),
    DATABASE_PATH: z.string().min(1).default("./data/supplywatch.sqlite"),
    DRY_RUN: booleanFromString,
    DISCORD_WEBHOOK_URL: z.string().optional(),
    POLL_INTERVAL_SECONDS: positiveIntegerFromString(60),
    OBSERVATION_WINDOW_SECONDS: positiveIntegerFromString(15),
    FULL_SWEEP_INTERVAL_MINUTES: positiveIntegerFromString(60),
    OUT_OF_STOCK_RETIRE_CONFIRMATIONS: positiveIntegerFromString(3),
    NOTIFY_MAX_ATTEMPTS: positiveIntegerFromString(10),
  })
  .superRefine((value, context) => {
    if (!value.DRY_RUN && !value.DISCORD_WEBHOOK_URL) {
      context.addIssue({
        code: "custom",
        path: ["DISCORD_WEBHOOK_URL"],
        message: "DISCORD_WEBHOOK_URL is required when DRY_RUN=false",
      });
    }
  });

export type SupplywatchConfig = z.infer<typeof envSchema>;

export function parseConfig(
  env: Record<string, string | undefined>,
): SupplywatchConfig {
  return envSchema.parse(env);
}

export function loadConfig(): SupplywatchConfig {
  return parseConfig(process.env);
}

export function redactConfig(
  config: SupplywatchConfig,
): Record<string, unknown> {
  return {
    ...config,
    DISCORD_WEBHOOK_URL: config.DISCORD_WEBHOOK_URL ? "[redacted]" : undefined,
  };
}

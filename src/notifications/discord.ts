import type {
  JsonObject,
  PersistedEventRecord,
  WatcherStateRepository,
} from "@supplywatch/state";

export type DiscordWebhookPayload = {
  content: string | null;
  embeds: DiscordEmbed[];
};

export type DiscordEmbed = {
  title: string;
  url?: string;
  description?: string;
  color: number;
  timestamp?: string;
  image?: {
    url: string;
  };
  fields: DiscordEmbedField[];
  footer?: {
    text: string;
  };
};

export type DiscordEmbedField = {
  name: string;
  value: string;
  inline: boolean;
};

export type NotificationDispatchResult = {
  dryRun: number;
  failed: number;
  sent: number;
  skipped: number;
};

export type DiscordWebhookSender = (
  webhookUrl: string,
  payload: DiscordWebhookPayload,
) => Promise<void>;

export type NotificationDispatchOptions = {
  dryRun: boolean;
  webhookUrl: string | undefined;
  now: string;
  maxAttempts: number;
  retryWindowMs?: number;
  send?: DiscordWebhookSender;
  log?: (message: string) => void;
};

const MERCH_COLOR = 0x10a37f;
const HEALTH_COLOR = 0xf59e0b;
const DEFAULT_RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;
const RETRY_WINDOW_EXPIRED_ERROR =
  "Notification retry window expired after roughly 24 hours";

export async function dispatchPendingNotifications(
  repository: WatcherStateRepository,
  options: NotificationDispatchOptions,
): Promise<NotificationDispatchResult> {
  const result: NotificationDispatchResult = {
    dryRun: 0,
    failed: 0,
    sent: 0,
    skipped: 0,
  };
  const retryWindowMs = options.retryWindowMs ?? DEFAULT_RETRY_WINDOW_MS;
  const send = options.send ?? sendDiscordWebhook;

  for (const event of repository.listPendingNotificationEvents()) {
    if (!isDiscordAlertEvent(event)) {
      result.skipped += 1;
      continue;
    }

    const payload = renderDiscordWebhookPayload(event);

    if (options.dryRun) {
      options.log?.(JSON.stringify(payload));
      result.dryRun += 1;
      continue;
    }

    if (retryWindowExpired(event, options.now, retryWindowMs)) {
      recordFailedNotification(
        repository,
        event,
        event.attemptCount,
        options.now,
        RETRY_WINDOW_EXPIRED_ERROR,
        true,
      );
      result.failed += 1;
      continue;
    }

    if (event.attemptCount >= options.maxAttempts) {
      recordFailedNotification(
        repository,
        event,
        event.attemptCount,
        options.now,
        retryLimitReachedError(event.attemptCount),
        true,
      );
      result.failed += 1;
      continue;
    }

    if (!options.webhookUrl) {
      throw new Error("DISCORD_WEBHOOK_URL is required when DRY_RUN=false");
    }

    try {
      await send(options.webhookUrl, payload);
      repository.markNotificationSent(event.id, options.now);
      result.sent += 1;
    } catch (error) {
      const attemptCount = event.attemptCount + 1;
      const failed = attemptCount >= options.maxAttempts;
      recordFailedNotification(
        repository,
        event,
        attemptCount,
        options.now,
        errorMessage(error),
        failed,
      );

      if (failed) {
        result.failed += 1;
      }
    }
  }

  return result;
}

function recordFailedNotification(
  repository: WatcherStateRepository,
  event: PersistedEventRecord,
  attemptCount: number,
  lastAttemptAt: string,
  notificationError: string,
  failed: boolean,
): void {
  repository.recordNotificationFailure({
    id: event.id,
    attemptCount,
    lastAttemptAt,
    notificationError,
    failed,
  });
}

function retryLimitReachedError(attemptCount: number): string {
  return `Notification retry limit reached after ${attemptCount} attempts`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function retryWindowExpired(
  event: PersistedEventRecord,
  now: string,
  retryWindowMs: number,
): boolean {
  return (
    new Date(now).getTime() - new Date(event.createdAt).getTime() >
    retryWindowMs
  );
}

export function renderDiscordWebhookPayload(
  event: PersistedEventRecord,
): DiscordWebhookPayload {
  if (event.payload.alertKind === "health") {
    return renderHealthPayload(event);
  }

  return renderMerchPayload(event);
}

export async function sendDiscordWebhook(
  webhookUrl: string,
  payload: DiscordWebhookPayload,
): Promise<void> {
  const response = await fetch(webhookUrl, {
    body: JSON.stringify(payload),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Discord webhook failed with HTTP ${response.status}`);
  }
}

function renderMerchPayload(
  event: PersistedEventRecord,
): DiscordWebhookPayload {
  const payload = event.payload;
  const productName = stringValue(payload.productName) ?? "Supply product";
  const productUrl = stringValue(payload.productUrl);
  const description = stringValue(payload.description);
  const imageUrl = stringValue(payload.imageUrl);
  const observedAt = stringValue(payload.observedAt) ?? event.createdAt;
  const fields = compactFields([
    field("Price", stringValue(payload.price), true),
    field("Available sizes", stringArrayValue(payload.availableSizes), true),
    field("Confidence", stringValue(payload.confidence), true),
    field(
      "Action evidence",
      actionEvidenceValue(payload.actionEvidence),
      false,
    ),
    field("Detector evidence", detectorEvidenceValue(payload.detectors), false),
    field("Evidence", evidenceValue(payload.evidence), false),
  ]);

  return {
    content: null,
    embeds: [
      {
        title: productName,
        ...(productUrl ? { url: productUrl } : {}),
        ...(description ? { description } : {}),
        color: MERCH_COLOR,
        timestamp: observedAt,
        ...(imageUrl ? { image: { url: imageUrl } } : {}),
        fields,
        footer: {
          text: `supplywatch merch alert • ${event.eventType}`,
        },
      },
    ],
  };
}

function renderHealthPayload(
  event: PersistedEventRecord,
): DiscordWebhookPayload {
  const payload = event.payload;
  const title = stringValue(payload.title) ?? "Supplywatch health alert";
  const description =
    stringValue(payload.description) ??
    stringValue(payload.errorMessage) ??
    "Operational health event recorded.";

  return {
    content: null,
    embeds: [
      {
        title,
        description,
        color: HEALTH_COLOR,
        timestamp: stringValue(payload.observedAt) ?? event.createdAt,
        fields: compactFields([
          field("Event", event.eventType, true),
          field("Scope", stringValue(payload.scope), true),
        ]),
        footer: {
          text: "supplywatch health alert • rate-limit eligible",
        },
      },
    ],
  };
}

function isDiscordAlertEvent(event: PersistedEventRecord): boolean {
  return (
    event.payload.alertKind === "merch" || event.payload.alertKind === "health"
  );
}

function compactFields(
  fields: Array<DiscordEmbedField | null>,
): DiscordEmbedField[] {
  return fields.filter((item): item is DiscordEmbedField => item !== null);
}

function field(
  name: string,
  value: string | null | undefined,
  inline: boolean,
): DiscordEmbedField | null {
  if (!value) {
    return null;
  }

  return {
    name,
    value: truncateDiscordField(value),
    inline,
  };
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function stringArrayValue(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  return value.filter((item) => typeof item === "string").join(", ");
}

function evidenceValue(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  return value
    .map((item) => evidenceItemValue(item))
    .filter((item): item is string => Boolean(item))
    .join("\n");
}

function evidenceItemValue(value: unknown): string | null {
  if (!isJsonObject(value)) {
    return null;
  }

  const kind = stringValue(value.kind);
  const message = stringValue(value.message);
  const itemValue = stringValue(value.value);
  const base = [kind, message].filter(Boolean).join(": ");

  if (!base) {
    return itemValue;
  }

  return itemValue ? `${base} (${itemValue})` : base;
}

function actionEvidenceValue(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  return value
    .map((item) => {
      if (!isJsonObject(item)) {
        return null;
      }

      const label = stringValue(item.label);
      const href = stringValue(item.href);

      return [label, href].filter(Boolean).join(" -> ");
    })
    .filter((item): item is string => Boolean(item))
    .join("\n");
}

function detectorEvidenceValue(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  return value
    .map((item) => {
      if (!isJsonObject(item)) {
        return null;
      }

      const name = stringValue(item.name);
      const confidence = stringValue(item.confidence);
      const matched = item.matched === true ? "matched" : "not matched";

      if (!name) {
        return null;
      }

      return confidence
        ? `${name}: ${matched} (${confidence})`
        : `${name}: ${matched}`;
    })
    .filter((item): item is string => Boolean(item))
    .join("\n");
}

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function truncateDiscordField(value: string): string {
  return value.length > 1024 ? `${value.slice(0, 1021)}...` : value;
}

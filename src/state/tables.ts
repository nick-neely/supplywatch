import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const products = sqliteTable("products", {
  stableId: text("stable_id").primaryKey(),
  name: text("name"),
  url: text("url"),
  imageUrl: text("image_url"),
  description: text("description"),
  collection: text("collection"),
  price: text("price"),
  normalizedSnapshotJson: text("normalized_snapshot_json").notNull(),
  rawFingerprint: text("raw_fingerprint"),
  buyableState: text("buyable_state").notNull(),
  availableSizesJson: text("available_sizes_json").notNull().default("[]"),
  firstSeenAt: text("first_seen_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
  firstPublicAt: text("first_public_at"),
  outOfStockConfirmations: integer("out_of_stock_confirmations")
    .notNull()
    .default(0),
  retiredAt: text("retired_at"),
  retirementReason: text("retirement_reason"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventHash: text("event_hash").notNull().unique(),
    eventType: text("event_type").notNull(),
    productId: text("product_id").references(() => products.stableId, {
      onDelete: "set null",
    }),
    payloadJson: text("payload_json").notNull(),
    notificationStatus: text("notification_status")
      .notNull()
      .default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastAttemptAt: text("last_attempt_at"),
    notificationError: text("notification_error"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    notifiedAt: text("notified_at"),
  },
  (table) => [
    index("events_notification_status_idx").on(
      table.notificationStatus,
      table.attemptCount,
      table.createdAt,
    ),
  ],
);

export const runs = sqliteTable("runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  status: text("status").notNull(),
  productCount: integer("product_count").notNull().default(0),
  errorMessage: text("error_message"),
});

export const productOverrides = sqliteTable("product_overrides", {
  productId: text("product_id").primaryKey(),
  denylisted: integer("denylisted", { mode: "boolean" })
    .notNull()
    .default(false),
  forceRetired: integer("force_retired", { mode: "boolean" })
    .notNull()
    .default(false),
  forceWatched: integer("force_watched", { mode: "boolean" })
    .notNull()
    .default(false),
  knownEmployeeOnly: integer("known_employee_only", { mode: "boolean" })
    .notNull()
    .default(false),
  annotation: text("annotation"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

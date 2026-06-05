export const BUYABLE_STATES = [
  "unknown",
  "out_of_stock",
  "publicly_buyable",
  "employee_only",
] as const;

export type BuyableState = (typeof BUYABLE_STATES)[number];

export const NOTIFICATION_STATUSES = [
  "pending",
  "sent",
  "failed",
  "dry_run",
] as const;

export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const RUN_STATUSES = ["running", "completed", "failed"] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

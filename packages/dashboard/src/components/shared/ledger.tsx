import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { statusClass, statusVariant } from "@/lib/status";

export function StatusChip({ value }: { value: string }) {
  return (
    <Badge
      className={`sw-status ${statusClass(value)}`}
      variant={statusVariant(value)}
    >
      {value}
    </Badge>
  );
}

export function ChipList({ values }: { values: string[] }) {
  return (
    <span className="flex flex-wrap gap-2">
      {values.map((value) => (
        <Badge
          className="sw-status sw-status--neutral"
          variant="outline"
          key={value}
        >
          {value}
        </Badge>
      ))}
    </span>
  );
}

export function DetailField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="sw-detail-field">
      <dt className="sw-detail-label">{label}</dt>
      <dd className="sw-detail-value">{children}</dd>
    </div>
  );
}

export function LedgerSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="sw-ledger-section">
      <h2 className="sw-ledger-heading">{title}</h2>
      {children}
    </section>
  );
}

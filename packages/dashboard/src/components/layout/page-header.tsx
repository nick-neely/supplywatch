import { RefreshCcwIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  actionLabel: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  backHref?: string;
  backParentLabel?: string;
  secondaryActions?: ReactNode;
  children?: ReactNode;
};

export function PageHeader({
  eyebrow = "Watcher dashboard",
  title,
  actionLabel,
  isRefreshing,
  onRefresh,
  backHref,
  backParentLabel,
  secondaryActions,
  children,
}: PageHeaderProps) {
  return (
    <header className="sw-page-header">
      <div className="sw-page-heading">
        {backHref && backParentLabel ? (
          <p className="sw-parent-link">
            <a href={backHref}>{backParentLabel}</a>
          </p>
        ) : (
          <p className="sw-kicker">{eyebrow}</p>
        )}
        <h1 className="sw-page-title">{title}</h1>
        {children}
      </div>
      <div className="sw-page-actions">
        {secondaryActions}
        <Button type="button" onClick={onRefresh}>
          <RefreshCcwIcon data-icon="inline-start" />
          {isRefreshing ? "Refreshing..." : actionLabel}
        </Button>
      </div>
    </header>
  );
}

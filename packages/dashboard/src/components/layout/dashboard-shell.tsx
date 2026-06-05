import type { ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ErrorPanel({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function LoadingPanel({ label }: { label: string }) {
  return (
    <Card aria-label={label} className="sw-evidence-card">
      <CardContent className="flex flex-col gap-3 pt-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-20 w-full" />
      </CardContent>
    </Card>
  );
}

export function LoadingTable({ label }: { label: string }) {
  return (
    <Card aria-label={label} className="sw-evidence-card">
      <CardContent className="flex flex-col gap-2 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
      </CardContent>
    </Card>
  );
}

export function Toolbar({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="sw-toolbar" aria-label={label}>
      {children}
    </section>
  );
}

export function PaginationFooter({
  label,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
}: {
  label: string;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <footer className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <Button
          disabled={!canGoPrevious}
          size="sm"
          type="button"
          variant="outline"
          onClick={onPrevious}
        >
          Previous page
        </Button>
        <Button
          disabled={!canGoNext}
          size="sm"
          type="button"
          variant="outline"
          onClick={onNext}
        >
          Next page
        </Button>
      </div>
    </footer>
  );
}

export function TableShell({
  summary,
  children,
  footer,
}: {
  summary: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="sw-table-shell">
      <div className="sw-table-summary sw-table-summary-row">{summary}</div>
      {children}
      {footer}
    </div>
  );
}

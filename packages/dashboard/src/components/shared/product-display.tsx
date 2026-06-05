import type {
  DashboardEventRow,
  DashboardProductRow,
} from "@supplywatch/state";
import type { ReactNode } from "react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function EventProductLink({
  event,
}: {
  event: Pick<DashboardEventRow, "productId" | "productName">;
}) {
  if (!event.productId) {
    return <>none</>;
  }

  return (
    <a href={`/products/${encodeURIComponent(event.productId)}`}>
      {event.productName ?? event.productId}
    </a>
  );
}

export function ProductIdentity({ product }: { product: DashboardProductRow }) {
  const label = product.name ?? product.stableId;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <ProductImage compact product={product} />
      <a
        className="line-clamp-2 min-w-0 font-medium underline-offset-4 hover:underline"
        href={`/products/${encodeURIComponent(product.stableId)}`}
        title={label}
      >
        {label}
      </a>
    </div>
  );
}

export function ProductImage({
  product,
  compact = false,
}: {
  product: {
    imageUrl: string | null;
    name: string | null;
    stableId: string;
  };
  compact?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (compact) {
    return (
      <Avatar className="sw-product-avatar">
        {product.imageUrl && !failed ? (
          <AvatarImage
            alt={product.name ?? product.stableId}
            src={product.imageUrl}
            onError={() => setFailed(true)}
          />
        ) : null}
        <AvatarFallback>NA</AvatarFallback>
      </Avatar>
    );
  }

  if (!product.imageUrl || failed) {
    return (
      <div className="sw-image-panel">
        <span className="sw-empty-note">Image unavailable</span>
      </div>
    );
  }

  return (
    <img
      alt={product.name ?? product.stableId}
      className="sw-product-image"
      src={product.imageUrl}
      onError={() => setFailed(true)}
    />
  );
}

export function SummaryPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="sw-evidence-card" size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  );
}

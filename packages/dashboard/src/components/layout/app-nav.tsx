import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function NavLink({
  active,
  children,
  href,
}: {
  active: boolean;
  children: ReactNode;
  href: string;
}) {
  return (
    <Button
      asChild
      size="sm"
      variant={active ? "secondary" : "ghost"}
      aria-current={active ? "page" : undefined}
    >
      <a href={href}>{children}</a>
    </Button>
  );
}

export function AppNav({ pathname }: { pathname: string }) {
  return (
    <nav className="sw-topbar" aria-label="Dashboard navigation">
      <div className="sw-nav-list">
        <NavLink
          active={pathname === "/" || pathname.startsWith("/products")}
          href="/products"
        >
          Products
        </NavLink>
        <NavLink active={pathname.startsWith("/events")} href="/events">
          Events
        </NavLink>
        <NavLink active={pathname.startsWith("/runs")} href="/runs">
          Runs
        </NavLink>
        <NavLink active={pathname === "/summary"} href="/summary">
          Summary
        </NavLink>
      </div>
      <div className="sw-brand-mark" aria-hidden="true">
        supplywatch
      </div>
    </nav>
  );
}

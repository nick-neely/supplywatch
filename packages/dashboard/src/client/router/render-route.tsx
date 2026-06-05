import type { ReactNode } from "react";
import {
  fetchEventDetailFromApi,
  fetchEventsFromApi,
  fetchProductDetailFromApi,
  fetchProductsFromApi,
  fetchRunDetailFromApi,
  fetchRunsFromApi,
  fetchSummaryFromApi,
} from "@/client/api/fetchers";
import { DEFAULT_REFRESH_INTERVAL_MS } from "@/client/constants";
import type { AppProps } from "@/client/types";
import { EventDetailPage } from "@/components/events/event-detail-page";
import { EventsPage } from "@/components/events/events-page";
import { ProductDetailPage } from "@/components/products/product-detail-page";
import { ProductsPage } from "@/components/products/products-page";
import { RunDetailPage } from "@/components/runs/run-detail-page";
import { RunsPage } from "@/components/runs/runs-page";
import { SummaryPage } from "@/components/summary/summary-page";

type ResolvedAppProps = Required<AppProps>;

export function renderRoute(
  pathname: string,
  props: ResolvedAppProps,
): ReactNode {
  if (pathname === "/summary") {
    return (
      <SummaryPage
        fetchSummary={props.fetchSummary}
        refreshIntervalMs={props.refreshIntervalMs}
      />
    );
  }

  if (pathname.startsWith("/products/")) {
    return (
      <ProductDetailPage
        fetchProductDetail={props.fetchProductDetail}
        refreshIntervalMs={props.refreshIntervalMs}
        stableId={decodeURIComponent(pathname.replace("/products/", ""))}
      />
    );
  }

  if (pathname === "/runs") {
    return (
      <RunsPage
        fetchRuns={props.fetchRuns}
        refreshIntervalMs={props.refreshIntervalMs}
      />
    );
  }

  if (pathname === "/events") {
    return (
      <EventsPage
        fetchEvents={props.fetchEvents}
        refreshIntervalMs={props.refreshIntervalMs}
      />
    );
  }

  if (pathname.startsWith("/events/")) {
    return (
      <EventDetailPage
        fetchEventDetail={props.fetchEventDetail}
        eventId={Number(pathname.replace("/events/", ""))}
        refreshIntervalMs={props.refreshIntervalMs}
      />
    );
  }

  if (pathname.startsWith("/runs/")) {
    return (
      <RunDetailPage
        fetchRunDetail={props.fetchRunDetail}
        refreshIntervalMs={props.refreshIntervalMs}
        runId={Number(pathname.replace("/runs/", ""))}
      />
    );
  }

  return (
    <ProductsPage
      fetchProducts={props.fetchProducts}
      refreshIntervalMs={props.refreshIntervalMs}
    />
  );
}

export function resolveAppProps(props: AppProps): ResolvedAppProps {
  return {
    fetchSummary: props.fetchSummary ?? fetchSummaryFromApi,
    fetchProducts: props.fetchProducts ?? fetchProductsFromApi,
    fetchProductDetail: props.fetchProductDetail ?? fetchProductDetailFromApi,
    fetchEvents: props.fetchEvents ?? fetchEventsFromApi,
    fetchEventDetail: props.fetchEventDetail ?? fetchEventDetailFromApi,
    fetchRuns: props.fetchRuns ?? fetchRunsFromApi,
    fetchRunDetail: props.fetchRunDetail ?? fetchRunDetailFromApi,
    refreshIntervalMs: props.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS,
  };
}

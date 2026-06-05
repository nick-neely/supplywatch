import { useRoute } from "@/client/hooks/use-route";
import { renderRoute, resolveAppProps } from "@/client/router/render-route";
import type { AppProps } from "@/client/types";
import { AppNav } from "@/components/layout/app-nav";
import "./styles.css";

export type {
  AppProps,
  EventDetailFetcher,
  EventsFetcher,
  EventsTableState,
  ProductDetailFetcher,
  ProductListFetcher,
  RunDetailFetcher,
  RunsFetcher,
  RunsTableState,
  SummaryFetcher,
} from "@/client/types";

export function App(props: AppProps) {
  const route = useRoute();
  const resolvedProps = resolveAppProps(props);

  return (
    <main className="sw-app-shell">
      <AppNav pathname={route.pathname} />
      {renderRoute(route.pathname, resolvedProps)}
    </main>
  );
}

import { createReadStream, existsSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { extname, isAbsolute, join, normalize, sep } from "node:path";
import {
  BUYABLE_STATES,
  type BuyableState,
  DASHBOARD_PRODUCT_SORT_FIELDS,
  DASHBOARD_PRODUCT_WATCH_STATUSES,
  type DashboardEventSortBy,
  type DashboardProductSort,
  type DashboardProductSortField,
  type DashboardProductWatchStatus,
  type DashboardRunSortBy,
  type DashboardSortDirection,
  getDashboardEventDetail,
  getDashboardProductDetail,
  getDashboardProducts,
  getDashboardRunDetail,
  getWatcherDashboardSummary,
  listDashboardEvents,
  listDashboardRuns,
  NOTIFICATION_STATUSES,
  type NotificationStatus,
  type OpenReadOnlyStateDatabase,
  openReadOnlyStateDatabase,
  RUN_STATUSES,
  type RunStatus,
} from "@supplywatch/state";

const RUN_SORT_COLUMNS = [
  "startedAt",
  "finishedAt",
  "status",
  "productCount",
] as const satisfies readonly DashboardRunSortBy[];
const EVENT_SORT_COLUMNS = [
  "createdAt",
  "notifiedAt",
  "eventType",
  "notificationStatus",
  "attemptCount",
] as const satisfies readonly DashboardEventSortBy[];

export type DashboardServerOptions = {
  databasePath: string;
  host: string;
  port: number;
  staticDir?: string;
  now?: () => Date;
};

export type DashboardServer = {
  url: string;
  close: () => Promise<void>;
};

export async function createDashboardServer(
  options: DashboardServerOptions,
): Promise<DashboardServer> {
  let state: OpenReadOnlyStateDatabase;

  try {
    state = openReadOnlyStateDatabase(options.databasePath);
  } catch (error) {
    throw new Error(
      `Unable to open dashboard database read-only: ${options.databasePath}`,
      { cause: error },
    );
  }

  const server = createServer((request, response) =>
    handleRequest(request, response, state, options),
  );

  try {
    await listen(server, options.port, options.host);
  } catch (error) {
    state.close();
    throw error;
  }

  const address = server.address();
  const port =
    typeof address === "object" && address ? address.port : options.port;

  return {
    url: `http://${options.host}:${port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          state.close();
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }),
  };
}

function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  state: OpenReadOnlyStateDatabase,
  options: DashboardServerOptions,
): void {
  if (!request.url) {
    response.writeHead(400).end();
    return;
  }

  const url = new URL(request.url, "http://localhost");

  if (url.pathname === "/api/summary") {
    const summary = getWatcherDashboardSummary(state.database, {
      now: options.now?.(),
    });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(summary));
    return;
  }

  if (url.pathname === "/api/products") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify(
        getDashboardProducts(state.database, productListOptions(url)),
      ),
    );
    return;
  }

  const productDetailMatch = url.pathname.match(/^\/api\/products\/(.+)$/);
  if (productDetailMatch) {
    const stableId = decodeURIComponent(productDetailMatch[1] ?? "");
    const product = getDashboardProductDetail(state.database, stableId);

    if (!product) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Product not found" }));
      return;
    }

    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(product));
    return;
  }

  if (url.pathname === "/api/events") {
    const events = listDashboardEvents(state.database, {
      eventType: optionalParam(url.searchParams.get("eventType")),
      notificationStatus: parseNotificationStatus(
        url.searchParams.get("notificationStatus"),
      ),
      productId: optionalParam(url.searchParams.get("productId")),
      sortBy: parseEventSortBy(url.searchParams.get("sort")),
      sortDirection: parseSortDirection(url.searchParams.get("direction")),
      page: positiveInteger(url.searchParams.get("page")),
      pageSize: positiveInteger(url.searchParams.get("pageSize")),
    });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(events));
    return;
  }

  const eventDetailMatch = /^\/api\/events\/(\d+)$/.exec(url.pathname);
  if (eventDetailMatch) {
    const event = getDashboardEventDetail(
      state.database,
      Number(eventDetailMatch[1]),
    );

    if (!event) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Event not found" }));
      return;
    }

    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(event));
    return;
  }

  if (url.pathname === "/api/runs") {
    const runs = listDashboardRuns(state.database, {
      status: parseRunStatus(url.searchParams.get("status")),
      sortBy: parseRunSortBy(url.searchParams.get("sort")),
      sortDirection: parseSortDirection(url.searchParams.get("direction")),
      page: positiveInteger(url.searchParams.get("page")),
      pageSize: positiveInteger(url.searchParams.get("pageSize")),
      now: options.now?.(),
    });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(runs));
    return;
  }

  const runDetailMatch = /^\/api\/runs\/(\d+)$/.exec(url.pathname);
  if (runDetailMatch) {
    const run = getDashboardRunDetail(
      state.database,
      Number(runDetailMatch[1]),
      {
        now: options.now?.(),
      },
    );

    if (!run) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "Run not found" }));
      return;
    }

    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(run));
    return;
  }

  if (options.staticDir) {
    serveStaticFile(options.staticDir, url.pathname, response);
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "Not found" }));
}

function productListOptions(
  url: URL,
): Parameters<typeof getDashboardProducts>[1] {
  return {
    search: optionalParam(url.searchParams.get("search")),
    availabilityStates: availabilityStates(url.searchParams),
    watchStatus: watchStatus(url.searchParams.get("watchStatus")),
    collection: optionalParam(url.searchParams.get("collection")),
    notificationRelevant:
      url.searchParams.get("notificationRelevant") === "true"
        ? true
        : undefined,
    sort: productSort(url.searchParams.get("sort")),
    page: positiveInteger(url.searchParams.get("page")),
    pageSize: positiveInteger(url.searchParams.get("pageSize")),
  };
}

function optionalParam(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function availabilityStates(searchParams: URLSearchParams): BuyableState[] {
  return searchParams
    .getAll("availability")
    .flatMap((value) => selectedAvailabilityStates(value));
}

function selectedAvailabilityStates(value: string): BuyableState[] {
  return value.split(",").flatMap((state) => {
    const parsed = availabilityState(state);
    return parsed ? [parsed] : [];
  });
}

function availabilityState(value: string): BuyableState | undefined {
  return BUYABLE_STATES.find((state) => state === value);
}

function watchStatus(
  value: string | null,
): DashboardProductWatchStatus | undefined {
  for (const status of DASHBOARD_PRODUCT_WATCH_STATUSES) {
    if (value === status) {
      return status;
    }
  }

  return undefined;
}

function productSort(value: string | null): DashboardProductSort | undefined {
  const [field, direction] = value?.split(".") ?? [];

  if (!isProductSortField(field)) {
    return undefined;
  }

  return {
    field,
    direction: direction === "asc" ? "asc" : "desc",
  };
}

function isProductSortField(
  value: string | undefined,
): value is DashboardProductSortField {
  return DASHBOARD_PRODUCT_SORT_FIELDS.some((field) => field === value);
}

function parseRunStatus(value: string | null): RunStatus | undefined {
  if (isRunStatus(value)) {
    return value;
  }

  return undefined;
}

function parseRunSortBy(value: string | null): DashboardRunSortBy | undefined {
  if (isRunSortColumn(value)) {
    return value;
  }

  return undefined;
}

function parseEventSortBy(
  value: string | null,
): DashboardEventSortBy | undefined {
  if (isEventSortColumn(value)) {
    return value;
  }

  return undefined;
}

function parseNotificationStatus(
  value: string | null,
): NotificationStatus | undefined {
  if (isNotificationStatus(value)) {
    return value;
  }

  return undefined;
}

function parseSortDirection(
  value: string | null,
): DashboardSortDirection | undefined {
  return value === "asc" || value === "desc" ? value : undefined;
}

function isRunStatus(value: string | null): value is RunStatus {
  return RUN_STATUSES.some((status) => status === value);
}

function isNotificationStatus(
  value: string | null,
): value is NotificationStatus {
  return NOTIFICATION_STATUSES.some((status) => status === value);
}

function isRunSortColumn(value: string | null): value is DashboardRunSortBy {
  return RUN_SORT_COLUMNS.some((column) => column === value);
}

function isEventSortColumn(
  value: string | null,
): value is DashboardEventSortBy {
  return EVENT_SORT_COLUMNS.some((column) => column === value);
}

function positiveInteger(value: string | null): number | undefined {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return undefined;
  }

  return parsed;
}

function listen(server: Server, port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function serveStaticFile(
  staticDir: string,
  pathname: string,
  response: ServerResponse,
): void {
  const normalizedPath = normalize(
    pathname === "/" ? "index.html" : pathname.slice(1),
  );

  if (isUnsafeStaticPath(normalizedPath)) {
    response.writeHead(403).end();
    return;
  }

  const filePath = join(staticDir, normalizedPath);
  const fallbackPath = join(staticDir, "index.html");
  const servedPath = existsSync(filePath) ? filePath : fallbackPath;

  if (!existsSync(servedPath)) {
    response.writeHead(404).end();
    return;
  }

  response.writeHead(200, { "content-type": contentType(servedPath) });
  createReadStream(servedPath).pipe(response);
}

function isUnsafeStaticPath(normalizedPath: string): boolean {
  return (
    isAbsolute(normalizedPath) ||
    normalizedPath === ".." ||
    normalizedPath.startsWith(`..${sep}`)
  );
}

function contentType(filePath: string): string {
  switch (extname(filePath)) {
    case ".css":
      return "text/css";
    case ".js":
      return "text/javascript";
    case ".html":
      return "text/html";
    default:
      return "application/octet-stream";
  }
}

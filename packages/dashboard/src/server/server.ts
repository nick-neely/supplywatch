import { createReadStream, existsSync } from "node:fs";
import { createServer, type Server, type ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import {
  getWatcherDashboardSummary,
  openReadOnlyStateDatabase,
} from "@supplywatch/state";

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
  let state: ReturnType<typeof openReadOnlyStateDatabase>;

  try {
    state = openReadOnlyStateDatabase(options.databasePath);
  } catch (error) {
    throw new Error(
      `Unable to open dashboard database read-only: ${options.databasePath}`,
      { cause: error },
    );
  }

  const server = createServer((request, response) => {
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

    if (options.staticDir) {
      serveStaticFile(options.staticDir, url.pathname, response);
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "Not found" }));
  });

  await listen(server, options.port, options.host);
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
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const normalizedPath = normalize(relativePath);

  if (normalizedPath.startsWith("..")) {
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

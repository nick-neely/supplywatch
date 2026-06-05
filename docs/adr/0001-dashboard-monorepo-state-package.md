# Separate Dashboard App with Shared State Package

Supplywatch will move to a pnpm workspace monorepo with the watcher and dashboard as separate apps, and SQLite schema/repository/read-model code in a shared state package. The dashboard is a local read-only interface over watcher state, so it needs direct access to the same persistence model without importing worker internals; the monorepo split adds some setup overhead now but keeps app boundaries clear as the UI grows.

The watcher must remain runnable without installing, building, or running the dashboard. The dashboard backend should open the configured SQLite database in read-only mode for v1 so local UI refreshes can inspect the latest committed watcher state without gaining write capability.

The dashboard app will use Vite/React with a separate local Node API server rather than Next.js. The API will expose dashboard-specific read models with server-authoritative pagination, filtering, and sorting; the React UI will use shadcn/ui table primitives with TanStack Table and virtualized rows for large product, event, and run lists.

The dashboard is local-only and unauthenticated for v1. It should bind to localhost by default, infer watcher health from persisted database state rather than OS process inspection, and keep stable product, event, and run routes so future notification deep links can be added without changing the navigation model.

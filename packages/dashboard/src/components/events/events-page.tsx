import type { DashboardEventList } from "@supplywatch/state";
import { NOTIFICATION_STATUSES } from "@supplywatch/state/types";
import {
  getCoreRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import { fetchEventsFromApi } from "@/client/api/fetchers";
import { EVENT_PAGE_SIZE_OPTIONS } from "@/client/constants";
import { useDashboardRefresh } from "@/client/hooks/use-dashboard-refresh";
import {
  isEventSort,
  parseEventsTableState,
  parseNotificationStatus,
  serializeEventsTableState,
} from "@/client/lib/parsers/events";
import { navigateTo } from "@/client/router/navigate";
import type { EventsFetcher, EventsTableState } from "@/client/types";
import { DataTable } from "@/components/data-table/data-table";
import {
  EVENT_GROW_COLUMNS,
  eventColumns,
} from "@/components/events/event-columns";
import { SelectFilter, TextFilter } from "@/components/filters/table-filters";
import {
  ErrorPanel,
  LoadingTable,
  PaginationFooter,
  TableShell,
  Toolbar,
} from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/layout/page-header";
import { errorMessage } from "@/lib/error-message";

type EventsPageProps = {
  fetchEvents?: EventsFetcher;
  refreshIntervalMs: number;
};

export function EventsPage({
  fetchEvents = fetchEventsFromApi,
  refreshIntervalMs,
}: EventsPageProps) {
  const [tableState, setTableState] = useState(() =>
    parseEventsTableState(window.location.search),
  );
  const [events, setEvents] = useState<DashboardEventList | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { isRefreshing, refreshNow } = useDashboardRefresh(
    useCallback(
      async (isMounted) => {
        setError(null);

        try {
          const nextEvents = await fetchEvents(tableState);
          if (isMounted()) {
            setEvents(nextEvents);
          }
        } catch (caught) {
          if (isMounted()) {
            setError(errorMessage(caught));
          }
        }
      },
      [fetchEvents, tableState],
    ),
    refreshIntervalMs,
  );

  const updateTableState = (next: Partial<EventsTableState>) => {
    const updated = { ...tableState, ...next };
    setTableState(updated);
    navigateTo(`/events?${serializeEventsTableState(updated)}`);
  };

  const sorting = useMemo<SortingState>(
    () => [
      {
        id: tableState.sortBy,
        desc: tableState.sortDirection === "desc",
      },
    ],
    [tableState.sortBy, tableState.sortDirection],
  );

  const table = useReactTable({
    data: events?.events ?? [],
    columns: eventColumns,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      if (next.length === 0) {
        return;
      }

      const column = next[0];
      if (!column || !isEventSort(column.id)) {
        return;
      }

      updateTableState({
        sortBy: column.id,
        sortDirection: column.desc ? "desc" : "asc",
        page: 1,
      });
    },
    manualSorting: true,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        actionLabel="Refresh Events"
        isRefreshing={isRefreshing}
        title="Events"
        onRefresh={refreshNow}
      />

      <Toolbar label="Event filters">
        <TextFilter
          label="Event type"
          name="event-type"
          value={tableState.eventType ?? ""}
          onChange={(value) =>
            updateTableState({
              eventType: value || undefined,
              page: 1,
            })
          }
        />
        <TextFilter
          label="Product"
          name="event-product"
          value={tableState.productId ?? ""}
          onChange={(value) =>
            updateTableState({
              productId: value || undefined,
              page: 1,
            })
          }
        />
        <SelectFilter
          label="Notification status"
          value={tableState.notificationStatus ?? "all"}
          options={[
            { value: "all", label: "All statuses" },
            ...NOTIFICATION_STATUSES.map((status) => ({
              value: status,
              label: status,
            })),
          ]}
          onChange={(value) =>
            updateTableState({
              notificationStatus: parseNotificationStatus(value),
              page: 1,
            })
          }
        />
        <SelectFilter
          ariaLabel="Event rows per page"
          label="Rows"
          value={String(tableState.pageSize)}
          options={EVENT_PAGE_SIZE_OPTIONS.map((pageSize) => ({
            value: String(pageSize),
            label: String(pageSize),
          }))}
          onChange={(value) =>
            updateTableState({
              pageSize: Number(value),
              page: 1,
            })
          }
        />
      </Toolbar>

      {error ? <ErrorPanel message={error} /> : null}

      {events ? (
        <TableShell
          summary={
            <>
              <span>
                Showing <strong>{events.events.length}</strong> of{" "}
                <strong>{events.pagination.totalItems}</strong> Events
              </span>
              <span>
                Page <strong>{events.pagination.page}</strong> of{" "}
                <strong>{events.pagination.totalPages}</strong>
              </span>
            </>
          }
          footer={
            <PaginationFooter
              canGoNext={tableState.page < events.pagination.totalPages}
              canGoPrevious={tableState.page > 1}
              label={`Page ${events.pagination.page} of ${events.pagination.totalPages}, ${events.pagination.totalItems} Events`}
              onNext={() =>
                updateTableState({
                  page: Math.min(
                    events.pagination.totalPages,
                    tableState.page + 1,
                  ),
                })
              }
              onPrevious={() =>
                updateTableState({
                  page: Math.max(1, tableState.page - 1),
                })
              }
            />
          }
        >
          <DataTable growColumnIds={EVENT_GROW_COLUMNS} table={table} />
        </TableShell>
      ) : (
        <LoadingTable label="Loading Events" />
      )}
    </div>
  );
}

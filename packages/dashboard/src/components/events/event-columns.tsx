import type { DashboardEventRow } from "@supplywatch/state";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { StatusChip } from "@/components/shared/ledger";
import { EventProductLink } from "@/components/shared/product-display";
import { TableTimestamp } from "@/components/shared/table-timestamp";
import { Badge } from "@/components/ui/badge";
import { isCandidateSignalEvent } from "@/lib/events";

export const eventColumns: ColumnDef<DashboardEventRow>[] = [
  {
    id: "eventType",
    accessorKey: "eventType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Event" />
    ),
    enableSorting: true,
    cell: ({ row }) => (
      <span className="line-clamp-2 min-w-0 whitespace-normal">
        <a href={`/events/${row.original.id}`} title={row.original.eventType}>
          {row.original.eventType}
        </a>
        {isCandidateSignalEvent(row.original.eventType) ? (
          <Badge
            className="sw-status sw-status--candidate ml-2"
            variant="outline"
          >
            Candidate evidence
          </Badge>
        ) : null}
      </span>
    ),
  },
  {
    accessorKey: "productId",
    header: "Product",
    enableSorting: false,
    cell: ({ row }) => <EventProductLink event={row.original} />,
  },
  {
    accessorKey: "notificationStatus",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Notification" />
    ),
    enableSorting: true,
    cell: ({ row }) => <StatusChip value={row.original.notificationStatus} />,
  },
  {
    accessorKey: "attemptCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Attempts" />
    ),
    enableSorting: true,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    enableSorting: true,
    cell: ({ row }) => <TableTimestamp value={row.original.createdAt} />,
  },
  {
    accessorKey: "notifiedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Notified" />
    ),
    enableSorting: true,
    cell: ({ row }) => <TableTimestamp value={row.original.notifiedAt} />,
  },
  {
    id: "details",
    header: "Details",
    enableSorting: false,
    cell: ({ row }) => (
      <span>
        {row.original.hasPayload ? "Payload" : "No payload"}
        {row.original.hasNotificationError ? ", error" : ""}
      </span>
    ),
  },
];

export const EVENT_GROW_COLUMNS = ["eventType"];

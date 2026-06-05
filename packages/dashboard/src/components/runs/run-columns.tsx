import type { DashboardRunRow } from "@supplywatch/state";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { StatusChip } from "@/components/shared/ledger";
import { TableTimestamp } from "@/components/shared/table-timestamp";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/format-duration";

export const runColumns: ColumnDef<DashboardRunRow>[] = [
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    enableSorting: true,
    cell: ({ row }) => (
      <span>
        <StatusChip value={row.original.status} />
        {row.original.staleRunning ? (
          <Badge className="sw-status sw-status--stale ml-2" variant="outline">
            Stale-looking, {row.original.staleRunning.minutesSinceStart}m
          </Badge>
        ) : null}
      </span>
    ),
  },
  {
    accessorKey: "startedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Started" />
    ),
    enableSorting: true,
    cell: ({ row }) => <TableTimestamp value={row.original.startedAt} />,
  },
  {
    accessorKey: "finishedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Finished" />
    ),
    enableSorting: true,
    cell: ({ row }) => <TableTimestamp value={row.original.finishedAt} />,
  },
  {
    id: "duration",
    header: "Duration",
    enableSorting: false,
    cell: ({ row }) => formatDuration(row.original.durationMs),
  },
  {
    accessorKey: "productCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Products" />
    ),
    enableSorting: true,
  },
  {
    id: "error",
    header: "Error",
    enableSorting: false,
    cell: ({ row }) => (row.original.hasError ? "Present" : "None"),
  },
  {
    id: "detail",
    header: "",
    enableSorting: false,
    cell: ({ row }) => <a href={`/runs/${row.original.id}`}>View Run</a>,
  },
];

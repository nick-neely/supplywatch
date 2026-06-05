import type { DashboardProductRow } from "@supplywatch/state";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { ChipList, StatusChip } from "@/components/shared/ledger";
import { ProductIdentity } from "@/components/shared/product-display";
import { TableTimestamp } from "@/components/shared/table-timestamp";
import { availabilityLabel } from "@/lib/availability";

export const productColumns: ColumnDef<DashboardProductRow>[] = [
  {
    id: "name",
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Product" />
    ),
    enableSorting: true,
    cell: ({ row }) => <ProductIdentity product={row.original} />,
  },
  {
    accessorKey: "collection",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Collection" />
    ),
    enableSorting: true,
    cell: ({ row }) => row.original.collection ?? "none",
  },
  {
    accessorKey: "price",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Price" />
    ),
    enableSorting: true,
    cell: ({ row }) => row.original.price ?? "none",
  },
  {
    accessorKey: "availabilityState",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Availability state" />
    ),
    enableSorting: true,
    cell: ({ row }) => (
      <StatusChip value={availabilityLabel(row.original.availabilityState)} />
    ),
  },
  {
    accessorKey: "availableSizes",
    header: "Sizes",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.availableSizes.length > 0
        ? row.original.availableSizes.join(", ")
        : "none",
  },
  {
    accessorKey: "lastSeenAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last seen" />
    ),
    enableSorting: true,
    cell: ({ row }) => <TableTimestamp value={row.original.lastSeenAt} />,
  },
  {
    accessorKey: "firstSeenAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="First seen" />
    ),
    enableSorting: true,
    cell: ({ row }) => <TableTimestamp value={row.original.firstSeenAt} />,
  },
  {
    accessorKey: "isRetired",
    header: "Watch status",
    enableSorting: false,
    cell: ({ row }) => (row.original.isRetired ? "retired" : "active"),
  },
  {
    accessorKey: "overrideBadges",
    header: "Product overrides",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.overrideBadges.length > 0 ? (
        <ChipList values={row.original.overrideBadges} />
      ) : (
        "none"
      ),
  },
];

export const PRODUCT_GROW_COLUMNS = ["name"];

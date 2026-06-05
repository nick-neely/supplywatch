import {
  flexRender,
  type Table as ReactTable,
  type RowData,
} from "@tanstack/react-table";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type DataTableProps<TData extends RowData> = {
  table: ReactTable<TData>;
  growColumnIds?: string[];
  emptyMessage?: string;
};

export function DataTable<TData extends RowData>({
  table,
  growColumnIds = [],
  emptyMessage = "No results.",
}: DataTableProps<TData>) {
  const columns = table.getAllColumns().length;

  return (
    <div className="sw-table-card">
      <div className="sw-table-viewport">
        <table className="sw-table" data-slot="table">
          <TableHeader className="sw-table-header">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    className={cn(
                      "sw-table-head",
                      growColumnIds.includes(header.column.id)
                        ? "sw-cell-grow"
                        : undefined,
                    )}
                    key={header.id}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      className={cn(
                        growColumnIds.includes(cell.column.id)
                          ? "sw-cell-grow whitespace-normal"
                          : undefined,
                      )}
                      key={cell.id}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="h-24 text-center text-muted-foreground"
                  colSpan={columns}
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";

export function DataTable<T>({
  rows,
  columns,
  getRowKey,
  caption,
  ariaLabel
}: {
  rows: T[];
  columns: Array<{
    key: string;
    header: string;
    render: (row: T) => ReactNode;
  }>;
  getRowKey?: (row: T, index: number) => string | number;
  caption?: string;
  ariaLabel?: string;
}) {
  return (
    <div className="table-wrap">
      <table aria-label={caption ? undefined : ariaLabel}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={getRowKey ? getRowKey(row, index) : index}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

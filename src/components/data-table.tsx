import type { ReactNode } from "react";

export function DataTable<T>({
  rows,
  columns,
  getRowKey
}: {
  rows: T[];
  columns: Array<{
    key: string;
    header: string;
    render: (row: T) => ReactNode;
  }>;
  getRowKey?: (row: T, index: number) => string | number;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.header}</th>
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

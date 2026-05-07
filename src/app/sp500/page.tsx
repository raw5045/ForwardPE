import { DataTable } from "@/components/data-table";
import { MetricCard } from "@/components/metric-card";
import {
  getSp500Rows,
  type DashboardInstrumentRow
} from "@/lib/queries/dashboard";
import Link from "next/link";
import { getSnapshotDateLabel } from "./snapshot-label";

export const dynamic = "force-dynamic";

function formatCurrency(value: number | null) {
  return value == null
    ? "n/a"
    : value.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2
      });
}

function formatNumber(value: number | null, digits = 2) {
  return value == null
    ? "n/a"
    : value.toLocaleString("en-US", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits
      });
}

function formatPe(value: number | null) {
  return value == null ? "n/a" : `${formatNumber(value, 1)}x`;
}

function formatMethod(value: string) {
  return value.replaceAll("_", " ");
}

function medianForwardPe(rows: DashboardInstrumentRow[]) {
  const values = rows
    .map((row) => row.forwardPe)
    .filter((value): value is number => value != null)
    .sort((left, right) => left - right);

  if (values.length === 0) {
    return null;
  }

  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? (values[middle - 1] + values[middle]) / 2
    : values[middle];
}

export default async function Sp500Page() {
  const rows = await getSp500Rows();
  const pricedRows = rows.filter((row) => row.forwardPe != null).length;
  const snapshotDateLabel = getSnapshotDateLabel(rows);

  return (
    <main className="page-shell flow">
      <div className="page-header">
        <div>
          <p className="eyebrow">Constituent screener</p>
          <h1>S&P 500</h1>
        </div>
        <div className="header-meta">{snapshotDateLabel}</div>
      </div>

      <div className="metric-grid">
        <MetricCard
          label="Constituents"
          value={rows.length.toLocaleString("en-US")}
        />
        <MetricCard
          label="With Forward P/E"
          value={pricedRows.toLocaleString("en-US")}
        />
        <MetricCard
          label="Median Forward P/E"
          value={formatPe(medianForwardPe(rows))}
        />
      </div>

      <section className="dashboard-section flow">
        <div className="section-heading">
          <h2>Stock Valuations</h2>
        </div>
        {rows.length > 0 ? (
          <DataTable
            rows={rows}
            caption="S&P 500 constituent stock valuations"
            getRowKey={(row) => row.symbol}
            columns={[
              {
                key: "symbol",
                header: "Symbol",
                render: (row) => (
                  <Link className="symbol-link" href={`/stocks/${row.symbol}`}>
                    {row.symbol}
                  </Link>
                )
              },
              {
                key: "price",
                header: "Price",
                render: (row) => (
                  <span className="numeric">{formatCurrency(row.price)}</span>
                )
              },
              {
                key: "ntmEps",
                header: "NTM EPS",
                render: (row) => (
                  <span className="numeric">{formatNumber(row.ntmEps)}</span>
                )
              },
              {
                key: "forwardPe",
                header: "Forward P/E",
                render: (row) => (
                  <span className="numeric">{formatPe(row.forwardPe)}</span>
                )
              },
              {
                key: "method",
                header: "Method",
                render: (row) => (
                  <span className="method-label">{formatMethod(row.method)}</span>
                )
              },
              {
                key: "snapshotDate",
                header: "Snapshot Date",
                render: (row) => row.snapshotDate ?? "n/a"
              }
            ]}
          />
        ) : (
          <div className="empty-state">No S&P 500 constituent rows available.</div>
        )}
      </section>
    </main>
  );
}

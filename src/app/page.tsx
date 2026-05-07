import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { MethodMix } from "@/components/method-mix";
import { MetricCard } from "@/components/metric-card";
import {
  getOverviewRows,
  type DashboardInstrumentRow
} from "@/lib/queries/dashboard";

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

function formatPercent(value: number | null) {
  return value == null ? "n/a" : `${Math.round(value * 100)}%`;
}

function formatMethod(value: string) {
  return value.replaceAll("_", " ");
}

function latestSnapshot(rows: DashboardInstrumentRow[]) {
  return rows
    .map((row) => row.snapshotDate)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1);
}

export default async function HomePage() {
  const rows = await getOverviewRows();
  const sp500 = rows.find((row) => row.symbol === "SP500");
  const ndx = rows.find((row) => row.symbol === "NDX");
  const latestDate = latestSnapshot(rows);

  return (
    <main className="page-shell flow">
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal dashboard</p>
          <h1>Forward P/E Overview</h1>
        </div>
        <div className="header-meta">{latestDate ?? "No snapshots"}</div>
      </div>

      <div className="metric-grid">
        <MetricCard
          label="S&P 500 Forward P/E"
          value={formatPe(sp500?.forwardPe ?? null)}
          detail={`${formatPercent(sp500?.coveredWeight ?? null)} covered weight`}
        />
        <MetricCard
          label="Nasdaq-100 Forward P/E"
          value={formatPe(ndx?.forwardPe ?? null)}
          detail={ndx?.snapshotDate ?? "No snapshot"}
        />
        <MetricCard
          label="Tracked Views"
          value={rows.length.toLocaleString("en-US")}
          detail="Indexes and sector ETFs"
        />
      </div>

      <section className="dashboard-section flow">
        <div className="section-heading">
          <h2>Coverage Summary</h2>
        </div>
        {rows.length > 0 ? (
          <DataTable
            rows={rows}
            caption="Forward P/E overview coverage summary"
            getRowKey={(row) => row.symbol}
            columns={[
              {
                key: "symbol",
                header: "Symbol",
                render: (row) => (
                  <Link className="symbol-link" href={`/instruments/${row.symbol}`}>
                    {row.symbol}
                  </Link>
                )
              },
              { key: "name", header: "Name", render: (row) => row.name },
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
                key: "methodMix",
                header: "Method Mix",
                render: (row) => (
                  <MethodMix
                    quarterlyWeight={row.quarterlySumWeight}
                    fallbackWeight={row.fiscalYearInterpolationWeight}
                    unavailableWeight={row.unavailableWeight}
                  />
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
                header: "Snapshot",
                render: (row) => row.snapshotDate ?? "n/a"
              }
            ]}
          />
        ) : (
          <div className="empty-state">No overview rows available.</div>
        )}
      </section>
    </main>
  );
}

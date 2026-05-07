import { DataTable } from "@/components/data-table";
import { MethodMix } from "@/components/method-mix";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-pill";
import {
  getLatestMethodMix,
  getRecentIngestionRuns
} from "@/lib/queries/data-health";

export const dynamic = "force-dynamic";

function formatDateTime(value: string | null) {
  if (!value) {
    return "n/a";
  }

  return value.replace("T", " ").slice(0, 19);
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export default async function DataHealthPage() {
  const [runs, methodMix] = await Promise.all([
    getRecentIngestionRuns(),
    getLatestMethodMix()
  ]);
  const latestRun = runs[0];
  const unavailableAverage = average(
    methodMix.map((row) => row.unavailableWeight)
  );

  return (
    <main className="page-shell flow">
      <div className="page-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Data Health</h1>
        </div>
        <div className="header-meta">{latestRun?.runDate ?? "No runs"}</div>
      </div>

      <div className="metric-grid">
        <MetricCard
          label="Latest Run"
          value={latestRun?.status.replaceAll("_", " ") ?? "n/a"}
          detail={latestRun?.runDate ?? "No ingestion run"}
        />
        <MetricCard
          label="Aggregate Rows"
          value={methodMix.length.toLocaleString("en-US")}
          detail="Latest method coverage"
        />
        <MetricCard
          label="Average Unavailable"
          value={formatPercent(unavailableAverage)}
          detail="Across aggregate snapshots"
        />
      </div>

      <section className="dashboard-section flow">
        <div className="section-heading">
          <h2>Recent Ingestion Runs</h2>
        </div>
        {runs.length > 0 ? (
          <DataTable
            rows={runs}
            caption="Recent ingestion runs"
            getRowKey={(row) => row.id}
            columns={[
              {
                key: "status",
                header: "Status",
                render: (row) => <StatusBadge value={row.status} />
              },
              { key: "runDate", header: "Run Date", render: (row) => row.runDate },
              {
                key: "startedAt",
                header: "Started",
                render: (row) => formatDateTime(row.startedAt)
              },
              {
                key: "finishedAt",
                header: "Finished",
                render: (row) => formatDateTime(row.finishedAt)
              },
              {
                key: "error",
                header: "Error",
                render: (row) => row.error ?? ""
              }
            ]}
          />
        ) : (
          <div className="empty-state">No ingestion runs found.</div>
        )}
      </section>

      <section className="dashboard-section flow">
        <div className="section-heading">
          <h2>Latest Method Mix</h2>
        </div>
        <p className="section-note">
          Reported/unreported status currently uses estimate period end date as
          a proxy until actual report dates are ingested.
        </p>
        {methodMix.length > 0 ? (
          <DataTable
            rows={methodMix}
            caption="Latest aggregate NTM EPS method mix"
            getRowKey={(row) => `${row.symbol}-${row.snapshotDate}`}
            columns={[
              { key: "symbol", header: "Symbol", render: (row) => row.symbol },
              {
                key: "snapshotDate",
                header: "Snapshot",
                render: (row) => row.snapshotDate
              },
              {
                key: "mix",
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
                key: "counts",
                header: "Counts",
                render: (row) =>
                  `${row.quarterlySumCount} quarterly / ${row.fiscalYearInterpolationCount} fallback / ${row.unavailableCount} unavailable`
              }
            ]}
          />
        ) : (
          <div className="empty-state">No method mix rows found.</div>
        )}
      </section>
    </main>
  );
}

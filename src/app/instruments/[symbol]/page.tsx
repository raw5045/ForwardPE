import { MethodMix } from "@/components/method-mix";
import { MetricCard } from "@/components/metric-card";
import { ValuationChart } from "@/components/valuation-chart";
import { getInstrumentDetail } from "@/lib/queries/dashboard";

export const dynamic = "force-dynamic";

type InstrumentDetailPageProps = {
  params: Promise<{ symbol: string }>;
};

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

export default async function InstrumentDetailPage({
  params
}: InstrumentDetailPageProps) {
  const { symbol } = await params;
  const normalizedSymbol = decodeURIComponent(symbol).toUpperCase();
  const { row, history } = await getInstrumentDetail(normalizedSymbol);

  return (
    <main className="page-shell flow">
      <div className="page-header">
        <div>
          <p className="eyebrow">Instrument detail</p>
          <h1>{row ? row.name : normalizedSymbol}</h1>
        </div>
        <div className="header-meta">{row?.snapshotDate ?? "No snapshot"}</div>
      </div>

      {row ? (
        <>
          <div className="metric-grid">
            <MetricCard label="Price" value={formatCurrency(row.price)} />
            <MetricCard label="NTM EPS" value={formatNumber(row.ntmEps)} />
            <MetricCard
              label="Forward P/E"
              value={formatPe(row.forwardPe)}
              detail={formatMethod(row.method)}
            />
          </div>

          <section className="dashboard-section flow">
            <div className="section-heading">
              <h2>Current Valuation</h2>
            </div>
            <MethodMix
              quarterlyWeight={row.quarterlySumWeight}
              fallbackWeight={row.fiscalYearInterpolationWeight}
              unavailableWeight={row.unavailableWeight}
            />
          </section>
        </>
      ) : (
        <div className="empty-state">No current valuation found.</div>
      )}

      <section className="dashboard-section flow">
        <div className="section-heading">
          <h2>Forward P/E History</h2>
        </div>
        <ValuationChart data={history} />
      </section>
    </main>
  );
}

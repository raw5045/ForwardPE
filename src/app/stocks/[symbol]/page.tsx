import { MetricCard } from "@/components/metric-card";
import { ValuationChart } from "@/components/valuation-chart";
import { getInstrumentDetail } from "@/lib/queries/dashboard";

export const dynamic = "force-dynamic";

type StockDetailPageProps = {
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

export default async function StockDetailPage({ params }: StockDetailPageProps) {
  const { symbol } = await params;
  const normalizedSymbol = decodeURIComponent(symbol).toUpperCase();
  const { row, history } = await getInstrumentDetail(normalizedSymbol);

  return (
    <main className="page-shell flow">
      <div className="page-header">
        <div>
          <p className="eyebrow">Stock detail</p>
          <h1>{row ? `${row.symbol} Stock` : normalizedSymbol}</h1>
        </div>
        <div className="header-meta">{row?.snapshotDate ?? "No snapshot"}</div>
      </div>

      {row ? (
        <div className="metric-grid">
          <MetricCard
            label="Stock Price"
            value={formatCurrency(row.price)}
            detail={row.name}
          />
          <MetricCard
            label="Consensus NTM EPS"
            value={formatNumber(row.ntmEps)}
            detail={formatMethod(row.method)}
          />
          <MetricCard
            label="Forward P/E"
            value={formatPe(row.forwardPe)}
            detail={row.snapshotDate ?? undefined}
          />
        </div>
      ) : (
        <div className="empty-state">No current stock valuation found.</div>
      )}

      <section className="dashboard-section flow">
        <div className="section-heading">
          <h2>Stock Forward P/E History</h2>
        </div>
        <ValuationChart data={history} />
      </section>
    </main>
  );
}

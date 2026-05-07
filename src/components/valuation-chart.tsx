"use client";

import type { ValuationHistoryPoint } from "@/lib/queries/dashboard";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

export function ValuationChart({ data }: { data: ValuationHistoryPoint[] }) {
  if (data.length === 0) {
    return <div className="empty-state">No valuation history yet.</div>;
  }

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={data}
          margin={{ top: 10, right: 16, bottom: 0, left: 0 }}
        >
          <XAxis dataKey="snapshotDate" tickLine={false} />
          <YAxis tickLine={false} width={48} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="forwardPe"
            stroke="#0f766e"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

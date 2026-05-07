import { describe, expect, it } from "vitest";
import { runDailyIngestion } from "./run-daily-ingestion";

describe("runDailyIngestion", () => {
  it("records stock valuations and aggregate method coverage from providers", async () => {
    const writes: string[] = [];
    const repository = {
      startIngestionRun: async () => "run-1",
      finishIngestionRun: async () => {
        writes.push("finish");
      },
      failIngestionRun: async () => {
        writes.push("fail");
      },
      upsertInstrument: async () => {
        writes.push("instrument");
      },
      upsertGroup: async () => {
        writes.push("group");
      },
      upsertGroupMembership: async () => {
        writes.push("membership");
      },
      upsertPriceSnapshot: async () => {
        writes.push("price");
      },
      upsertEstimateSnapshot: async () => {
        writes.push("estimate");
      },
      upsertCompositionSnapshot: async () => {
        writes.push("composition");
      },
      upsertValuationSnapshot: async () => {
        writes.push("valuation");
      },
      getLatestGroupConstituents: async () => [
        { symbol: "AAPL", weight: 0.6 },
        { symbol: "MSFT", weight: 0.4 },
      ],
      getLatestStockValuations: async () => [
        {
          symbol: "AAPL",
          price: 100,
          ntmEps: 5,
          method: "quarterly_sum" as const,
        },
        {
          symbol: "MSFT",
          price: 50,
          ntmEps: 5,
          method: "fiscal_year_interpolation" as const,
        },
      ],
    };

    const provider = {
      getSp500Constituents: async () => [
        { symbol: "AAPL", name: "Apple Inc.", sector: "Technology", raw: {} },
        {
          symbol: "MSFT",
          name: "Microsoft Corp.",
          sector: "Technology",
          raw: {},
        },
      ],
      getEtfHoldings: async () => [],
      getQuotes: async () => [
        { symbol: "AAPL", price: 100, raw: {} },
        { symbol: "MSFT", price: 50, raw: {} },
      ],
      getEstimates: async (symbol: string, period: "annual" | "quarter") =>
        period === "quarter"
          ? [
              {
                symbol,
                periodType: "quarter" as const,
                fiscalYear: 2026,
                fiscalQuarter: 2,
                periodEndDate: "2026-06-30",
                epsAvg: 1,
                epsLow: null,
                epsHigh: null,
                analystCount: 10,
                raw: {},
              },
              {
                symbol,
                periodType: "quarter" as const,
                fiscalYear: 2026,
                fiscalQuarter: 3,
                periodEndDate: "2026-09-30",
                epsAvg: 1,
                epsLow: null,
                epsHigh: null,
                analystCount: 10,
                raw: {},
              },
              {
                symbol,
                periodType: "quarter" as const,
                fiscalYear: 2026,
                fiscalQuarter: 4,
                periodEndDate: "2026-12-31",
                epsAvg: 1,
                epsLow: null,
                epsHigh: null,
                analystCount: 10,
                raw: {},
              },
              {
                symbol,
                periodType: "quarter" as const,
                fiscalYear: 2027,
                fiscalQuarter: 1,
                periodEndDate: "2027-03-31",
                epsAvg: 2,
                epsLow: null,
                epsHigh: null,
                analystCount: 10,
                raw: {},
              },
            ]
          : [],
    };

    const result = await runDailyIngestion({
      repository,
      provider,
      runDate: "2026-05-06",
    });

    expect(result.status).toBe("succeeded");
    expect(writes).toContain("valuation");
    expect(writes).toContain("finish");
  });
});

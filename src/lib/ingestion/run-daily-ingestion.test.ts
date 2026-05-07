import { describe, expect, it } from "vitest";
import type { IngestionProvider, IngestionRepository } from "./types";
import { runDailyIngestion } from "./run-daily-ingestion";

describe("runDailyIngestion", () => {
  it("records stock valuations and aggregate method coverage from providers", async () => {
    const finishedRuns: unknown[] = [];
    const membershipWrites: Array<
      Parameters<IngestionRepository["upsertGroupMembership"]>[0]
    > = [];
    const valuationWrites: Array<
      Parameters<IngestionRepository["upsertValuationSnapshot"]>[0]
    > = [];
    const repository: IngestionRepository = {
      startIngestionRun: async () => "run-1",
      finishIngestionRun: async (_runId, details) => {
        finishedRuns.push(details);
      },
      failIngestionRun: async () => {
        throw new Error("Expected ingestion to finish, not fail");
      },
      upsertInstrument: async () => {},
      upsertGroup: async () => {},
      upsertGroupMembership: async (input) => {
        membershipWrites.push(input);
      },
      upsertPriceSnapshot: async () => {},
      upsertEstimateSnapshot: async () => {},
      upsertCompositionSnapshot: async () => {},
      upsertValuationSnapshot: async (input) => {
        valuationWrites.push(input);
      },
      getLatestGroupConstituents: async () =>
        membershipWrites.map((write) => ({
          symbol: write.symbol,
          weight: write.weight ?? 0,
        })),
      getLatestStockValuations: async (_snapshotDate, symbols) =>
        valuationWrites
          .filter((write) => symbols.includes(write.symbol))
          .flatMap((write) =>
            write.valuation.method === "aggregate"
              ? []
              : [
                  {
                    symbol: write.symbol,
                    price: write.valuation.price,
                    ntmEps: write.valuation.ntmEps,
                    method: write.valuation.method,
                  },
                ],
          ),
    };

    const requestedHoldingsSymbols: string[] = [];
    const provider: IngestionProvider = {
      getSp500Constituents: async () => [
        {
          symbol: "AAPL",
          name: "Apple Inc.",
          sector: "Technology",
          raw: { id: "constituent-aapl" },
        },
        {
          symbol: "MSFT",
          name: "Microsoft Corp.",
          sector: "Technology",
          raw: { id: "constituent-msft" },
        },
      ],
      getEtfHoldings: async (symbol) => {
        requestedHoldingsSymbols.push(symbol);

        return [
          {
            symbol: "AAPL",
            name: "Apple Inc.",
            weight: 0.6,
            raw: { asset: "AAPL", weightPercentage: 60 },
          },
          {
            symbol: "MSFT",
            name: "Microsoft Corp.",
            weight: 0.4,
            raw: { asset: "MSFT", weightPercentage: 40 },
          },
        ];
      },
      getQuotes: async () => [
        { symbol: "AAPL", price: 100, raw: {} },
        { symbol: "MSFT", price: 50, raw: {} },
      ],
      getEstimates: async (symbol: string, period: "annual" | "quarter") =>
        symbol === "AAPL" && period === "quarter"
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
          : symbol === "MSFT" && period === "annual"
            ? [
                {
                  symbol,
                  periodType: "annual" as const,
                  fiscalYear: 2026,
                  fiscalQuarter: null,
                  periodEndDate: "2026-12-31",
                  epsAvg: 5,
                  epsLow: null,
                  epsHigh: null,
                  analystCount: 10,
                  raw: {},
                },
                {
                  symbol,
                  periodType: "annual" as const,
                  fiscalYear: 2027,
                  fiscalQuarter: null,
                  periodEndDate: "2027-12-31",
                  epsAvg: 5,
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
    expect(finishedRuns).toEqual([
      { status: "succeeded", symbolsProcessed: 2, errors: [] },
    ]);
    expect(requestedHoldingsSymbols).toEqual(["SPY"]);
    expect(membershipWrites).toEqual([
      expect.objectContaining({
        symbol: "AAPL",
        source: "fmp_spy_holdings_proxy",
        weight: 0.6,
        raw: expect.objectContaining({
          constituent: expect.objectContaining({
            source: "fmp_sp500_constituents",
            raw: { id: "constituent-aapl" },
          }),
          weightProxy: expect.objectContaining({
            source: "fmp_spy_holdings_proxy",
            parentSymbol: "SPY",
            weight: 0.6,
            raw: { asset: "AAPL", weightPercentage: 60 },
          }),
        }),
      }),
      expect.objectContaining({
        symbol: "MSFT",
        source: "fmp_spy_holdings_proxy",
        weight: 0.4,
      }),
    ]);

    const aaplValuation = valuationWrites.find(
      (write) => write.symbol === "AAPL",
    );
    const msftValuation = valuationWrites.find(
      (write) => write.symbol === "MSFT",
    );
    const aggregateWrite = valuationWrites.find(
      (write) => write.symbol === "SP500",
    );

    expect(aaplValuation).toMatchObject({
      snapshotDate: "2026-05-06",
      source: "fmp_consensus_ntm_private",
      valuation: expect.objectContaining({
        method: "quarterly_sum",
        price: 100,
        ntmEps: 5,
      }),
    });
    expect(msftValuation).toMatchObject({
      snapshotDate: "2026-05-06",
      source: "fmp_consensus_ntm_private",
      valuation: expect.objectContaining({
        method: "fiscal_year_interpolation",
        price: 50,
        ntmEps: 5,
      }),
    });
    expect(aggregateWrite).toMatchObject({
      snapshotDate: "2026-05-06",
      source: "fmp_consensus_ntm_private",
    });
    expect(aggregateWrite?.valuation.method).toBe("aggregate");

    if (aggregateWrite?.valuation.method !== "aggregate") {
      throw new Error("Expected SP500 aggregate valuation");
    }

    expect(aggregateWrite.valuation.coveredWeight).toBeCloseTo(1);
    expect(aggregateWrite.valuation.quarterlySumWeight).toBeCloseTo(0.6);
    expect(
      aggregateWrite.valuation.fiscalYearInterpolationWeight,
    ).toBeCloseTo(0.4);
    expect(aggregateWrite.valuation.coveredConstituentCount).toBe(2);
    expect(aggregateWrite.valuation.quarterlySumCount).toBe(1);
    expect(aggregateWrite.valuation.fiscalYearInterpolationCount).toBe(1);
    expect(aggregateWrite.valuation.unavailableCount).toBe(0);
    expect(aggregateWrite.valuation.constituentCount).toBe(2);
  });

  it("marks the run partial when SP500 has no positive stored weights", async () => {
    const membershipWrites: Array<
      Parameters<IngestionRepository["upsertGroupMembership"]>[0]
    > = [];
    const finishedRuns: unknown[] = [];
    const valuationWrites: Array<
      Parameters<IngestionRepository["upsertValuationSnapshot"]>[0]
    > = [];
    const repository: IngestionRepository = {
      startIngestionRun: async () => "run-1",
      finishIngestionRun: async (_runId, details) => {
        finishedRuns.push(details);
      },
      failIngestionRun: async () => {
        throw new Error("Expected ingestion to finish partial, not fail");
      },
      upsertInstrument: async () => {},
      upsertGroup: async () => {},
      upsertGroupMembership: async (input) => {
        membershipWrites.push(input);
      },
      upsertPriceSnapshot: async () => {},
      upsertEstimateSnapshot: async () => {},
      upsertCompositionSnapshot: async () => {},
      upsertValuationSnapshot: async (input) => {
        valuationWrites.push(input);
      },
      getLatestGroupConstituents: async () =>
        membershipWrites.map((write) => ({
          symbol: write.symbol,
          weight: write.weight ?? 0,
        })),
      getLatestStockValuations: async (_snapshotDate, symbols) =>
        valuationWrites
          .filter((write) => symbols.includes(write.symbol))
          .flatMap((write) =>
            write.valuation.method === "aggregate"
              ? []
              : [
                  {
                    symbol: write.symbol,
                    price: write.valuation.price,
                    ntmEps: write.valuation.ntmEps,
                    method: write.valuation.method,
                  },
                ],
          ),
    };
    const provider: IngestionProvider = {
      getSp500Constituents: async () => [
        { symbol: "AAPL", name: "Apple Inc.", sector: "Technology", raw: {} },
      ],
      getEtfHoldings: async () => [],
      getQuotes: async () => [{ symbol: "AAPL", price: 100, raw: {} }],
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

    expect(result.status).toBe("partial");
    expect(result.errors).toEqual([
      "SP500: no positive SPY holding weights available for aggregate",
    ]);
    expect(finishedRuns).toEqual([
      {
        status: "partial",
        symbolsProcessed: 1,
        errors: [
          "SP500: no positive SPY holding weights available for aggregate",
        ],
      },
    ]);

    const aggregateWrite = valuationWrites.find(
      (write) => write.symbol === "SP500",
    );
    expect(aggregateWrite).toBeUndefined();
  });
});

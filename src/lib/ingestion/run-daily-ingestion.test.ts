import { describe, expect, it } from "vitest";
import type { IngestionProvider, IngestionRepository } from "./types";
import { runDailyIngestion } from "./run-daily-ingestion";
import { sectorEtfs } from "../universe/defaults";

describe("runDailyIngestion", () => {
  it("records stock valuations and aggregate method coverage from providers", async () => {
    const events: string[] = [];
    const finishedRuns: unknown[] = [];
    const groupWrites: Array<Parameters<IngestionRepository["upsertGroup"]>[0]> =
      [];
    const instrumentWrites: Array<
      Parameters<IngestionRepository["upsertInstrument"]>[0]
    > = [];
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
      upsertInstrument: async (input) => {
        instrumentWrites.push(input);
        events.push(`instrument:${input.symbol}`);
      },
      upsertGroup: async (input) => {
        groupWrites.push(input);
      },
      upsertGroupMembership: async (input) => {
        membershipWrites.push(input);
      },
      upsertPriceSnapshot: async (input) => {
        events.push(`price:${input.symbol}`);
      },
      upsertEstimateSnapshot: async () => {},
      upsertCompositionSnapshot: async () => {},
      upsertValuationSnapshot: async (input) => {
        valuationWrites.push(input);
      },
      getLatestGroupConstituents: async () =>
        membershipWrites
          .filter((write) => write.groupSlug === "sp500")
          .map((write) => ({
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
      getQuotes: async (symbols) =>
        symbols.map((symbol) => ({
          symbol,
          price: symbol === "MSFT" ? 50 : 100,
          raw: {},
        })),
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
    expect(groupWrites).toEqual([
      { slug: "sp500", name: "S&P 500", type: "index" },
      { slug: "nasdaq100", name: "Nasdaq-100", type: "index" },
      { slug: "sector-etfs", name: "Sector ETFs", type: "watchlist" },
    ]);
    expect(instrumentWrites).toEqual(
      expect.arrayContaining([
        { symbol: "SP500", name: "S&P 500", type: "index" },
        { symbol: "QQQ", name: "Invesco QQQ Trust", type: "etf" },
        { symbol: "XLK", name: "XLK", type: "etf" },
      ]),
    );
    expect(membershipWrites).toEqual(
      expect.arrayContaining([
        {
          groupSlug: "sector-etfs",
          symbol: "XLK",
          effectiveDate: "2026-05-06",
          source: "manual_seed",
          raw: { symbol: "XLK" },
        },
      ]),
    );
    expect(events.indexOf("instrument:QQQ")).toBeGreaterThanOrEqual(0);
    expect(events.indexOf("instrument:QQQ")).toBeLessThan(
      events.indexOf("price:QQQ"),
    );
    expect(requestedHoldingsSymbols).toEqual(["SPY", "QQQ", ...sectorEtfs]);
    const sp500MembershipWrites = membershipWrites.filter(
      (write) => write.groupSlug === "sp500",
    );
    expect(sp500MembershipWrites).toEqual([
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

  it("writes QQQ, NDX, and sector ETF aggregates from ETF holdings and values non-SP500 stocks", async () => {
    const requestedHoldingsSymbols: string[] = [];
    const quoteRequests: string[][] = [];
    const instrumentWrites: Array<
      Parameters<IngestionRepository["upsertInstrument"]>[0]
    > = [];
    const compositionWrites: Array<
      Parameters<IngestionRepository["upsertCompositionSnapshot"]>[0]
    > = [];
    const membershipWrites: Array<
      Parameters<IngestionRepository["upsertGroupMembership"]>[0]
    > = [];
    const valuationWrites: Array<
      Parameters<IngestionRepository["upsertValuationSnapshot"]>[0]
    > = [];
    const eventOrder: string[] = [];
    const repository: IngestionRepository = {
      startIngestionRun: async () => "run-1",
      finishIngestionRun: async () => {},
      failIngestionRun: async () => {
        throw new Error("Expected ingestion to finish, not fail");
      },
      upsertInstrument: async (input) => {
        instrumentWrites.push(input);
        eventOrder.push(`instrument:${input.symbol}`);
      },
      upsertGroup: async () => {},
      upsertGroupMembership: async (input) => {
        membershipWrites.push(input);
      },
      upsertPriceSnapshot: async () => {},
      upsertEstimateSnapshot: async () => {},
      upsertCompositionSnapshot: async (input) => {
        compositionWrites.push(input);
        eventOrder.push(`composition:${input.parentSymbol}:${input.childSymbol}`);
      },
      upsertValuationSnapshot: async (input) => {
        valuationWrites.push(input);
        eventOrder.push(`valuation:${input.symbol}`);
      },
      getLatestGroupConstituents: async () =>
        membershipWrites
          .filter((write) => write.groupSlug === "sp500")
          .map((write) => ({
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
      getEtfHoldings: async (symbol) => {
        requestedHoldingsSymbols.push(symbol);

        if (symbol === "SPY") {
          return [
            {
              symbol: "AAPL",
              name: "Apple Inc.",
              weight: 1,
              raw: { asset: "AAPL", weightPercentage: 100 },
            },
          ];
        }

        return [
          {
            symbol: "NVDA",
            name: "NVIDIA Corp.",
            weight: 1,
            raw: { asset: "NVDA", weightPercentage: 100, parent: symbol },
          },
        ];
      },
      getQuotes: async (symbols) => {
        quoteRequests.push(symbols);

        return symbols.map((symbol) => ({
          symbol,
          price: 100,
          raw: {},
        }));
      },
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
                epsAvg: 1,
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
    expect(result.symbolsProcessed).toBe(2);
    expect(requestedHoldingsSymbols).toEqual(["SPY", "QQQ", ...sectorEtfs]);
    expect(quoteRequests[0]).toEqual(
      expect.arrayContaining(["AAPL", "NVDA", "QQQ", "XLK"]),
    );
    expect(instrumentWrites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          symbol: "NVDA",
          name: "NVIDIA Corp.",
          type: "stock",
        }),
      ]),
    );
    expect(compositionWrites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentSymbol: "QQQ",
          childSymbol: "NVDA",
          source: "fmp_etf_holdings",
        }),
        expect.objectContaining({
          parentSymbol: "NDX",
          childSymbol: "NVDA",
          source: "fmp_qqq_holdings_proxy",
          raw: expect.objectContaining({
            proxy: expect.objectContaining({
              source: "fmp_etf_holdings",
              parentSymbol: "QQQ",
            }),
          }),
        }),
        expect.objectContaining({
          parentSymbol: "XLK",
          childSymbol: "NVDA",
          source: "fmp_etf_holdings",
        }),
      ]),
    );

    for (const symbol of ["QQQ", "NDX", "XLK"]) {
      const aggregateWrite = valuationWrites.find(
        (write) => write.symbol === symbol,
      );
      expect(aggregateWrite).toMatchObject({
        snapshotDate: "2026-05-06",
        source: "fmp_consensus_ntm_private",
        valuation: expect.objectContaining({
          method: "aggregate",
          coveredWeight: 1,
        }),
      });
    }

    const nvdaValuation = valuationWrites.find(
      (write) => write.symbol === "NVDA",
    );
    expect(nvdaValuation).toMatchObject({
      source: "fmp_consensus_ntm_private",
      valuation: expect.objectContaining({
        method: "quarterly_sum",
        price: 100,
        ntmEps: 4,
      }),
    });
    expect(eventOrder.indexOf("composition:QQQ:NVDA")).toBeLessThan(
      eventOrder.indexOf("valuation:QQQ"),
    );
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
        membershipWrites
          .filter((write) => write.groupSlug === "sp500")
          .map((write) => ({
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
      getEtfHoldings: async (symbol) =>
        symbol === "SPY"
          ? []
          : [
              {
                symbol: "AAPL",
                name: "Apple Inc.",
                weight: 1,
                raw: {},
              },
            ],
      getQuotes: async (symbols) =>
        symbols.map((symbol) => ({ symbol, price: 100, raw: {} })),
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

  it("writes current unavailable QQQ, NDX, and sector aggregates when ETF holdings are missing", async () => {
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
        membershipWrites
          .filter((write) => write.groupSlug === "sp500")
          .map((write) => ({
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
      getEtfHoldings: async (symbol) =>
        symbol === "QQQ" || symbol === "XLK"
          ? []
          : [
              {
                symbol: "AAPL",
                name: "Apple Inc.",
                weight: 1,
                raw: { parent: symbol },
              },
            ],
      getQuotes: async (symbols) =>
        symbols.map((symbol) => ({ symbol, price: 100, raw: {} })),
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
                epsAvg: 1,
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
      "QQQ: no positive ETF holding weights available for aggregate",
      "NDX: no positive QQQ proxy holding weights available for aggregate",
      "XLK: no positive ETF holding weights available for aggregate",
    ]);
    expect(finishedRuns).toEqual([
      {
        status: "partial",
        symbolsProcessed: 1,
        errors: [
          "QQQ: no positive ETF holding weights available for aggregate",
          "NDX: no positive QQQ proxy holding weights available for aggregate",
          "XLK: no positive ETF holding weights available for aggregate",
        ],
      },
    ]);

    for (const symbol of ["QQQ", "NDX", "XLK"]) {
      const aggregateWrite = valuationWrites.find(
        (write) => write.symbol === symbol,
      );

      expect(aggregateWrite).toMatchObject({
        symbol,
        snapshotDate: "2026-05-06",
        source: "fmp_consensus_ntm_private",
        valuation: expect.objectContaining({
          method: "aggregate",
          forwardPe: null,
          coveredWeight: 0,
          missingWeight: 0,
          constituentCount: 0,
          coveredConstituentCount: 0,
        }),
      });
    }
  });

  it("does not aggregate stale memberships when the provider returns no current constituents", async () => {
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
      upsertGroupMembership: async () => {},
      upsertPriceSnapshot: async () => {},
      upsertEstimateSnapshot: async () => {},
      upsertCompositionSnapshot: async () => {},
      upsertValuationSnapshot: async (input) => {
        valuationWrites.push(input);
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
    const provider: IngestionProvider = {
      getSp500Constituents: async () => [],
      getEtfHoldings: async () => [
        { symbol: "AAPL", name: "Apple Inc.", weight: 1, raw: {} },
      ],
      getQuotes: async (symbols) =>
        symbols.map((symbol) => ({
          symbol,
          price: 100,
          raw: {},
        })),
      getEstimates: async () => [],
    };

    const result = await runDailyIngestion({
      repository,
      provider,
      runDate: "2026-05-06",
    });

    expect(result.status).toBe("partial");
    expect(result.errors).toEqual([
      "SP500: no constituents returned from provider",
    ]);
    expect(finishedRuns).toEqual([
      {
        status: "partial",
        symbolsProcessed: 1,
        errors: ["SP500: no constituents returned from provider"],
      },
    ]);
    expect(
      valuationWrites.find((write) => write.symbol === "SP500"),
    ).toBeUndefined();
  });
});

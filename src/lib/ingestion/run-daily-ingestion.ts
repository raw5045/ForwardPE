import { calculateAggregateValuation } from "../valuation/aggregate";
import { calculateStockValuation } from "../valuation/ntm";
import type { ProviderConstituent, ProviderHolding } from "../providers/types";
import type { EstimateInput } from "../valuation/types";
import { sectorEtfs } from "../universe/defaults";
import { seedUniverse } from "./seed-universe";
import type {
  IngestionProvider,
  IngestionRepository,
  IngestionResult,
} from "./types";

type RunDailyIngestionInput = {
  repository: IngestionRepository;
  provider: IngestionProvider;
  runDate: string;
};

const sp500MembershipSource = "fmp_spy_holdings_proxy";
const etfHoldingSource = "fmp_etf_holdings";
const ndxProxySource = "fmp_qqq_holdings_proxy";
const valuationSource = "fmp_consensus_ntm_private";
const missingSp500WeightError =
  "SP500: no positive SPY holding weights available for aggregate";
const missingSp500ConstituentsError =
  "SP500: no constituents returned from provider";
const missingEtfHoldingError = (symbol: string) =>
  `${symbol}: no positive ETF holding weights available for aggregate`;
const missingNdxProxyHoldingError =
  "NDX: no positive QQQ proxy holding weights available for aggregate";

function isPositiveFiniteNumber(
  value: number | null | undefined,
): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function providerEstimateToInput(
  estimate: {
    periodType: "quarter" | "annual";
    fiscalYear: number;
    fiscalQuarter: number | null;
    periodEndDate: string;
    epsAvg: number | null;
    analystCount: number | null;
  },
  valuationDate: string,
): EstimateInput {
  return {
    periodType: estimate.periodType,
    fiscalYear: estimate.fiscalYear,
    fiscalQuarter: estimate.fiscalQuarter ?? undefined,
    periodEndDate: estimate.periodEndDate,
    epsAvg: estimate.epsAvg,
    analystCount: estimate.analystCount,
    // FMP does not currently provide the actual report date here, so
    // reported/unreported status uses period end as an explicit proxy.
    reported: estimate.periodEndDate < valuationDate,
  };
}

function uniqueSymbols(symbols: string[]) {
  return Array.from(new Set(symbols));
}

function membershipRaw(
  constituent: ProviderConstituent,
  holding: ProviderHolding | undefined,
) {
  return {
    constituent: {
      source: "fmp_sp500_constituents",
      raw: constituent.raw,
    },
    weightProxy: holding
      ? {
          source: sp500MembershipSource,
          parentSymbol: "SPY",
          weight: holding.weight,
          raw: holding.raw,
        }
      : null,
  };
}

function holdingCompositionRaw(parentSymbol: string, holding: ProviderHolding) {
  return {
    holding: {
      source: etfHoldingSource,
      parentSymbol,
      raw: holding.raw,
    },
  };
}

function ndxProxyCompositionRaw(holding: ProviderHolding) {
  return {
    proxy: {
      source: etfHoldingSource,
      parentSymbol: "QQQ",
      raw: holding.raw,
    },
  };
}

function positiveHoldings(holdings: ProviderHolding[]) {
  return holdings.filter((holding) => isPositiveFiniteNumber(holding.weight));
}

export async function runDailyIngestion(
  input: RunDailyIngestionInput,
): Promise<IngestionResult> {
  const runId = await input.repository.startIngestionRun({
    runDate: input.runDate,
    kind: "daily",
  });
  const errors: string[] = [];
  let symbolsProcessed = 0;

  try {
    await seedUniverse(input.repository, input.runDate);

    const sp500Constituents = await input.provider.getSp500Constituents();
    const hasCurrentSp500Constituents = sp500Constituents.length > 0;
    if (!hasCurrentSp500Constituents) {
      errors.push(missingSp500ConstituentsError);
    }

    const spyHoldings = hasCurrentSp500Constituents
      ? await input.provider.getEtfHoldings("SPY")
      : [];
    const spyHoldingBySymbol = new Map(
      spyHoldings
        .filter((holding) => isPositiveFiniteNumber(holding.weight))
        .map((holding) => [holding.symbol, holding]),
    );

    for (const constituent of sp500Constituents) {
      const spyHolding = spyHoldingBySymbol.get(constituent.symbol);

      await input.repository.upsertInstrument({
        symbol: constituent.symbol,
        name: constituent.name,
        type: "stock",
        sector: constituent.sector,
        active: true,
      });
      await input.repository.upsertGroupMembership({
        groupSlug: "sp500",
        symbol: constituent.symbol,
        effectiveDate: input.runDate,
        weight: spyHolding?.weight ?? null,
        source: sp500MembershipSource,
        raw: membershipRaw(constituent, spyHolding),
      });
    }

    const etfHoldingSymbols = ["QQQ", ...sectorEtfs];
    const holdingsByParent = new Map<string, ProviderHolding[]>();
    for (const parentSymbol of etfHoldingSymbols) {
      holdingsByParent.set(
        parentSymbol,
        positiveHoldings(await input.provider.getEtfHoldings(parentSymbol)),
      );
    }

    const qqqHoldings = holdingsByParent.get("QQQ") ?? [];
    for (const [parentSymbol, holdings] of holdingsByParent) {
      for (const holding of holdings) {
        await input.repository.upsertInstrument({
          symbol: holding.symbol,
          name: holding.name ?? holding.symbol,
          type: "stock",
          active: true,
        });
        await input.repository.upsertCompositionSnapshot({
          parentSymbol,
          childSymbol: holding.symbol,
          snapshotDate: input.runDate,
          weight: holding.weight,
          source: etfHoldingSource,
          raw: holdingCompositionRaw(parentSymbol, holding),
        });
      }
    }

    for (const holding of qqqHoldings) {
      await input.repository.upsertCompositionSnapshot({
        parentSymbol: "NDX",
        childSymbol: holding.symbol,
        snapshotDate: input.runDate,
        weight: holding.weight,
        source: ndxProxySource,
        raw: ndxProxyCompositionRaw(holding),
      });
    }

    const stockSymbols = uniqueSymbols([
      ...sp500Constituents.map((constituent) => constituent.symbol),
      ...Array.from(holdingsByParent.values()).flatMap((holdings) =>
        holdings.map((holding) => holding.symbol),
      ),
    ]);
    const quoteSymbols = uniqueSymbols([...stockSymbols, "QQQ", ...sectorEtfs]);
    const quotes = await input.provider.getQuotes(quoteSymbols);
    const quoteBySymbol = new Map(
      quotes.map((quote) => [quote.symbol, quote]),
    );

    for (const quote of quotes) {
      await input.repository.upsertPriceSnapshot({
        symbol: quote.symbol,
        snapshotDate: input.runDate,
        price: quote.price,
        source: "fmp",
        raw: quote.raw,
      });
    }

    for (const symbol of stockSymbols) {
      try {
        const quarterly = await input.provider.getEstimates(symbol, "quarter");
        const annual = await input.provider.getEstimates(symbol, "annual");
        const estimates = [...quarterly, ...annual];

        for (const estimate of estimates) {
          await input.repository.upsertEstimateSnapshot({
            symbol,
            snapshotDate: input.runDate,
            estimate,
            source: "fmp",
          });
        }

        const valuation = calculateStockValuation({
          symbol,
          valuationDate: input.runDate,
          price: quoteBySymbol.get(symbol)?.price ?? null,
          fiscalYearEndMonth: 12,
          estimates: estimates.map((estimate) =>
            providerEstimateToInput(estimate, input.runDate),
          ),
        });

        await input.repository.upsertValuationSnapshot({
          symbol,
          snapshotDate: input.runDate,
          valuation,
          source: valuationSource,
        });
        symbolsProcessed += 1;
      } catch (error) {
        errors.push(
          `${symbol}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const latestStockValuations =
      await input.repository.getLatestStockValuations(
        input.runDate,
        stockSymbols,
      );
    const valuationBySymbol = new Map(
      latestStockValuations.map((row) => [row.symbol, row]),
    );

    const writeAggregateValuation = async (
      symbol: string,
      holdings: Array<{ symbol: string; weight: number }>,
      missingHoldingError: string,
    ) => {
      if (!holdings.some((holding) => isPositiveFiniteNumber(holding.weight))) {
        errors.push(missingHoldingError);
      }

      const aggregate = calculateAggregateValuation({
        symbol,
        valuationDate: input.runDate,
        constituents: holdings.map((holding) => ({
          symbol: holding.symbol,
          weight: holding.weight,
          price: valuationBySymbol.get(holding.symbol)?.price ?? null,
          ntmEps: valuationBySymbol.get(holding.symbol)?.ntmEps ?? null,
          method:
            valuationBySymbol.get(holding.symbol)?.method ?? "unavailable",
        })),
      });

      await input.repository.upsertValuationSnapshot({
        symbol,
        snapshotDate: input.runDate,
        valuation: aggregate,
        source: valuationSource,
      });
    };

    if (hasCurrentSp500Constituents) {
      const latestConstituents =
        await input.repository.getLatestGroupConstituents("sp500");
      const hasPositiveSp500Weight = latestConstituents.some((row) =>
        isPositiveFiniteNumber(row.weight),
      );

      if (!hasPositiveSp500Weight) {
        errors.push(missingSp500WeightError);
      } else {
        const aggregate = calculateAggregateValuation({
          symbol: "SP500",
          valuationDate: input.runDate,
          constituents: latestConstituents.map((row) => ({
            symbol: row.symbol,
            weight: row.weight,
            price: valuationBySymbol.get(row.symbol)?.price ?? null,
            ntmEps: valuationBySymbol.get(row.symbol)?.ntmEps ?? null,
            method: valuationBySymbol.get(row.symbol)?.method ?? "unavailable",
          })),
        });

        await input.repository.upsertValuationSnapshot({
          symbol: "SP500",
          snapshotDate: input.runDate,
          valuation: aggregate,
          source: valuationSource,
        });
      }
    }

    await writeAggregateValuation("QQQ", qqqHoldings, missingEtfHoldingError("QQQ"));
    await writeAggregateValuation("NDX", qqqHoldings, missingNdxProxyHoldingError);
    for (const symbol of sectorEtfs) {
      await writeAggregateValuation(
        symbol,
        holdingsByParent.get(symbol) ?? [],
        missingEtfHoldingError(symbol),
      );
    }

    const status = errors.length === 0 ? "succeeded" : "partial";
    await input.repository.finishIngestionRun(runId, {
      status,
      symbolsProcessed,
      errors,
    });

    return {
      status,
      runId,
      runDate: input.runDate,
      symbolsProcessed,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await input.repository.failIngestionRun(runId, message);

    return {
      status: "failed",
      runId,
      runDate: input.runDate,
      symbolsProcessed,
      errors: [message],
    };
  }
}

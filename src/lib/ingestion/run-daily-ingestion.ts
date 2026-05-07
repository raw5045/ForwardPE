import { calculateAggregateValuation } from "../valuation/aggregate";
import { calculateStockValuation } from "../valuation/ntm";
import type { ProviderConstituent, ProviderHolding } from "../providers/types";
import type { EstimateInput } from "../valuation/types";
import { sectorEtfs } from "../universe/defaults";
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
const missingSp500WeightError =
  "SP500: no positive SPY holding weights available for aggregate";

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
    await input.repository.upsertGroup({
      slug: "sp500",
      name: "S&P 500",
      type: "index",
    });

    const sp500Constituents = await input.provider.getSp500Constituents();
    const spyHoldings = await input.provider.getEtfHoldings("SPY");
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

    const symbols = sp500Constituents.map((constituent) => constituent.symbol);
    const quoteSymbols = uniqueSymbols([...symbols, "QQQ", ...sectorEtfs]);
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

    for (const symbol of symbols) {
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
          source: "fmp_consensus_ntm_private",
        });
        symbolsProcessed += 1;
      } catch (error) {
        errors.push(
          `${symbol}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const latestConstituents =
      await input.repository.getLatestGroupConstituents("sp500");
    if (
      !latestConstituents.some((row) => isPositiveFiniteNumber(row.weight))
    ) {
      errors.push(missingSp500WeightError);
    }

    const stockValuations = await input.repository.getLatestStockValuations(
      input.runDate,
      latestConstituents.map((row) => row.symbol),
    );
    const valuationBySymbol = new Map(
      stockValuations.map((row) => [row.symbol, row]),
    );
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
      source: "fmp_consensus_ntm_private",
    });

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

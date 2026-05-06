import type {
  AggregateValuationInput,
  AggregateValuationResult,
} from "./types";

const isPositiveFinite = (value: number | null): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

export function calculateAggregateValuation(
  input: AggregateValuationInput,
): AggregateValuationResult {
  let earningsYield = 0;
  let coveredWeight = 0;
  let missingWeight = 0;
  let quarterlySumWeight = 0;
  let fiscalYearInterpolationWeight = 0;
  let unavailableWeight = 0;
  let coveredConstituentCount = 0;
  let quarterlySumCount = 0;
  let fiscalYearInterpolationCount = 0;
  let unavailableCount = 0;

  for (const constituent of input.constituents) {
    const { method, ntmEps, price, weight } = constituent;
    const hasUsableWeight = isPositiveFinite(weight);

    if (hasUsableWeight) {
      if (method === "quarterly_sum") {
        quarterlySumWeight += weight;
        quarterlySumCount += 1;
      }

      if (method === "fiscal_year_interpolation") {
        fiscalYearInterpolationWeight += weight;
        fiscalYearInterpolationCount += 1;
      }

      if (method === "unavailable") {
        unavailableWeight += weight;
        unavailableCount += 1;
      }
    }

    const hasUsableValuation =
      hasUsableWeight &&
      isPositiveFinite(price) &&
      isPositiveFinite(ntmEps) &&
      method !== "unavailable";

    if (!hasUsableValuation) {
      if (hasUsableWeight) {
        missingWeight += weight;
        if (method !== "unavailable") {
          unavailableWeight += weight;
          unavailableCount += 1;
        }
      }
      continue;
    }

    const constituentEarningsYield = ntmEps / price;
    if (!isPositiveFinite(constituentEarningsYield)) {
      missingWeight += weight;
      unavailableWeight += weight;
      unavailableCount += 1;
      continue;
    }

    earningsYield += weight * constituentEarningsYield;
    coveredWeight += weight;
    coveredConstituentCount += 1;
  }

  const hasAggregateEarningsYield = isPositiveFinite(earningsYield);

  return {
    symbol: input.symbol,
    valuationDate: input.valuationDate,
    method: "aggregate",
    forwardPe: hasAggregateEarningsYield ? 1 / earningsYield : null,
    earningsYield: hasAggregateEarningsYield ? earningsYield : null,
    coveredWeight,
    missingWeight,
    quarterlySumWeight,
    fiscalYearInterpolationWeight,
    unavailableWeight,
    constituentCount: input.constituents.length,
    coveredConstituentCount,
    quarterlySumCount,
    fiscalYearInterpolationCount,
    unavailableCount,
  };
}

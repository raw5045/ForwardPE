import type {
  EstimateInput,
  StockValuationInput,
  StockValuationResult,
  UnavailableReason,
} from "./types";

function periodKey(estimate: EstimateInput) {
  return estimate.periodType === "quarter"
    ? `${estimate.fiscalYear}Q${estimate.fiscalQuarter}`
    : `${estimate.fiscalYear}`;
}

function averageAnalystCount(estimates: EstimateInput[]) {
  const counts = estimates
    .map((estimate) => estimate.analystCount)
    .filter((count): count is number => typeof count === "number");

  if (counts.length === 0) {
    return null;
  }

  return Math.round(
    counts.reduce((sum, count) => sum + count, 0) / counts.length,
  );
}

function remainingFullMonths(startDate: Date, endDate: Date) {
  const yearMonths =
    (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12;
  const monthDelta = endDate.getUTCMonth() - startDate.getUTCMonth();

  return Math.max(0, Math.min(12, yearMonths + monthDelta));
}

function unavailable(
  input: StockValuationInput,
  reason: UnavailableReason,
  fallbackReason?: "missing_quarterly_estimates",
  includedEstimates = input.estimates,
): StockValuationResult {
  return {
    symbol: input.symbol,
    method: "unavailable",
    price: input.price,
    ntmEps: null,
    earningsYield: null,
    forwardPe: null,
    estimatePeriods: [],
    analystCount: averageAnalystCount(includedEstimates),
    fallbackReason,
    unavailableReason: reason,
  };
}

function valuationResult(
  input: StockValuationInput,
  method: "quarterly_sum" | "fiscal_year_interpolation",
  price: number,
  ntmEps: number,
  estimates: EstimateInput[],
): StockValuationResult {
  return {
    symbol: input.symbol,
    method,
    price,
    ntmEps,
    earningsYield: ntmEps / price,
    forwardPe: price / ntmEps,
    estimatePeriods: estimates.map(periodKey),
    analystCount: averageAnalystCount(estimates),
    fallbackReason:
      method === "fiscal_year_interpolation"
        ? "missing_quarterly_estimates"
        : undefined,
  };
}

export function calculateStockValuation(
  input: StockValuationInput,
): StockValuationResult {
  if (input.price === null || input.price <= 0) {
    return unavailable(input, "missing_price");
  }

  const price = input.price;
  const quarterlyEstimates = input.estimates
    .filter(
      (estimate) =>
        estimate.periodType === "quarter" &&
        !estimate.reported &&
        typeof estimate.epsAvg === "number",
    )
    .sort((a, b) => a.periodEndDate.localeCompare(b.periodEndDate))
    .slice(0, 4);

  if (quarterlyEstimates.length === 4) {
    const ntmEps = quarterlyEstimates.reduce(
      (sum, estimate) => sum + Number(estimate.epsAvg),
      0,
    );

    if (ntmEps <= 0) {
      return unavailable(
        input,
        "non_positive_ntm_eps",
        undefined,
        quarterlyEstimates,
      );
    }

    return valuationResult(
      input,
      "quarterly_sum",
      price,
      ntmEps,
      quarterlyEstimates,
    );
  }

  const annualEstimates = input.estimates
    .filter(
      (estimate) =>
        estimate.periodType === "annual" &&
        !estimate.reported &&
        typeof estimate.epsAvg === "number",
    )
    .sort((a, b) => a.periodEndDate.localeCompare(b.periodEndDate))
    .slice(0, 2);

  if (annualEstimates.length < 2) {
    return unavailable(
      input,
      "missing_annual_estimates",
      "missing_quarterly_estimates",
    );
  }

  const valuationDate = new Date(`${input.valuationDate}T00:00:00.000Z`);
  const fy1EndDate = new Date(
    `${annualEstimates[0].periodEndDate}T00:00:00.000Z`,
  );
  const remainingCurrentFyMonths = remainingFullMonths(
    valuationDate,
    fy1EndDate,
  );
  const remainingCurrentFyWeight = remainingCurrentFyMonths / 12;
  const nextFyWeight = 1 - remainingCurrentFyWeight;
  const ntmEps =
    Number(annualEstimates[0].epsAvg) * remainingCurrentFyWeight +
    Number(annualEstimates[1].epsAvg) * nextFyWeight;

  if (ntmEps <= 0) {
    return unavailable(
      input,
      "non_positive_ntm_eps",
      "missing_quarterly_estimates",
      annualEstimates,
    );
  }

  return valuationResult(
    input,
    "fiscal_year_interpolation",
    price,
    ntmEps,
    annualEstimates,
  );
}

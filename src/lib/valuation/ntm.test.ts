import { describe, expect, it } from "vitest";
import { calculateStockValuation } from "./ntm";
import type { EstimateInput } from "./types";

const quarterly: EstimateInput[] = [
  {
    periodType: "quarter",
    fiscalYear: 2026,
    fiscalQuarter: 2,
    periodEndDate: "2026-06-30",
    epsAvg: 2.1,
    analystCount: 24,
    reported: false,
  },
  {
    periodType: "quarter",
    fiscalYear: 2026,
    fiscalQuarter: 3,
    periodEndDate: "2026-09-30",
    epsAvg: 2.2,
    analystCount: 24,
    reported: false,
  },
  {
    periodType: "quarter",
    fiscalYear: 2026,
    fiscalQuarter: 4,
    periodEndDate: "2026-12-31",
    epsAvg: 2.3,
    analystCount: 24,
    reported: false,
  },
  {
    periodType: "quarter",
    fiscalYear: 2027,
    fiscalQuarter: 1,
    periodEndDate: "2027-03-31",
    epsAvg: 2.4,
    analystCount: 23,
    reported: false,
  },
];

describe("calculateStockValuation", () => {
  it("uses the next four unreported quarterly estimates as the primary NTM EPS method", () => {
    const result = calculateStockValuation({
      symbol: "AAPL",
      valuationDate: "2026-05-06",
      price: 220,
      fiscalYearEndMonth: 9,
      estimates: quarterly,
    });

    expect(result.method).toBe("quarterly_sum");
    expect(result.ntmEps).toBeCloseTo(9.0, 5);
    expect(result.forwardPe).toBeCloseTo(24.44444, 5);
    expect(result.estimatePeriods).toEqual([
      "2026Q2",
      "2026Q3",
      "2026Q4",
      "2027Q1",
    ]);
  });

  it("falls back to FY1/FY2 interpolation when four quarterly estimates are unavailable", () => {
    const result = calculateStockValuation({
      symbol: "MSFT",
      valuationDate: "2026-05-06",
      price: 450,
      fiscalYearEndMonth: 12,
      estimates: [
        {
          periodType: "annual",
          fiscalYear: 2026,
          periodEndDate: "2026-12-31",
          epsAvg: 12,
          analystCount: 31,
          reported: false,
        },
        {
          periodType: "annual",
          fiscalYear: 2027,
          periodEndDate: "2027-12-31",
          epsAvg: 15,
          analystCount: 30,
          reported: false,
        },
      ],
    });

    expect(result.method).toBe("fiscal_year_interpolation");
    expect(result.ntmEps).toBeCloseTo(13.25, 5);
    expect(result.forwardPe).toBeCloseTo(33.96226, 5);
    expect(result.fallbackReason).toBe("missing_quarterly_estimates");
  });

  it("returns unavailable when price is missing", () => {
    const result = calculateStockValuation({
      symbol: "GOOGL",
      valuationDate: "2026-05-06",
      price: null,
      fiscalYearEndMonth: 12,
      estimates: quarterly,
    });

    expect(result.method).toBe("unavailable");
    expect(result.unavailableReason).toBe("missing_price");
  });

  it("returns unavailable when price is NaN", () => {
    const result = calculateStockValuation({
      symbol: "BADPRICE",
      valuationDate: "2026-05-06",
      price: Number.NaN,
      fiscalYearEndMonth: 12,
      estimates: quarterly,
    });

    expect(result.method).toBe("unavailable");
    expect(result.unavailableReason).toBe("missing_price");
  });

  it("ignores non-finite EPS rows instead of producing an available valuation", () => {
    const result = calculateStockValuation({
      symbol: "BADEPS",
      valuationDate: "2026-05-06",
      price: 100,
      fiscalYearEndMonth: 12,
      estimates: [
        {
          periodType: "quarter",
          fiscalYear: 2026,
          fiscalQuarter: 2,
          periodEndDate: "2026-06-30",
          epsAvg: Number.NaN,
          analystCount: 11,
          reported: false,
        },
        {
          periodType: "quarter",
          fiscalYear: 2026,
          fiscalQuarter: 3,
          periodEndDate: "2026-09-30",
          epsAvg: Number.POSITIVE_INFINITY,
          analystCount: 12,
          reported: false,
        },
        {
          periodType: "quarter",
          fiscalYear: 2026,
          fiscalQuarter: 4,
          periodEndDate: "2026-12-31",
          epsAvg: 2,
          analystCount: 13,
          reported: false,
        },
        {
          periodType: "quarter",
          fiscalYear: 2027,
          fiscalQuarter: 1,
          periodEndDate: "2027-03-31",
          epsAvg: 3,
          analystCount: 14,
          reported: false,
        },
        {
          periodType: "annual",
          fiscalYear: 2026,
          periodEndDate: "2026-12-31",
          epsAvg: Number.NaN,
          analystCount: 15,
          reported: false,
        },
        {
          periodType: "annual",
          fiscalYear: 2027,
          periodEndDate: "2027-12-31",
          epsAvg: Number.NEGATIVE_INFINITY,
          analystCount: 16,
          reported: false,
        },
      ],
    });

    expect(result.method).toBe("unavailable");
    expect(result.unavailableReason).toBe("missing_annual_estimates");
  });

  it("does not include stale unreported prior quarters in quarterly sum", () => {
    const result = calculateStockValuation({
      symbol: "AAPL",
      valuationDate: "2026-05-06",
      price: 220,
      fiscalYearEndMonth: 9,
      estimates: [
        {
          periodType: "quarter",
          fiscalYear: 2026,
          fiscalQuarter: 1,
          periodEndDate: "2026-03-31",
          epsAvg: 100,
          analystCount: 99,
          reported: false,
        },
        ...quarterly,
      ],
    });

    expect(result.method).toBe("quarterly_sum");
    expect(result.ntmEps).toBeCloseTo(9.0, 5);
    expect(result.estimatePeriods).toEqual([
      "2026Q2",
      "2026Q3",
      "2026Q4",
      "2027Q1",
    ]);
  });

  it("falls back to annual estimates when quarterly candidates are gapped", () => {
    const result = calculateStockValuation({
      symbol: "GAPQ",
      valuationDate: "2026-05-06",
      price: 450,
      fiscalYearEndMonth: 12,
      estimates: [
        {
          periodType: "quarter",
          fiscalYear: 2026,
          fiscalQuarter: 2,
          periodEndDate: "2026-06-30",
          epsAvg: 2,
          analystCount: 20,
          reported: false,
        },
        {
          periodType: "quarter",
          fiscalYear: 2026,
          fiscalQuarter: 3,
          periodEndDate: "2026-09-30",
          epsAvg: 2,
          analystCount: 20,
          reported: false,
        },
        {
          periodType: "quarter",
          fiscalYear: 2027,
          fiscalQuarter: 1,
          periodEndDate: "2027-03-31",
          epsAvg: 2,
          analystCount: 20,
          reported: false,
        },
        {
          periodType: "quarter",
          fiscalYear: 2027,
          fiscalQuarter: 2,
          periodEndDate: "2027-06-30",
          epsAvg: 2,
          analystCount: 20,
          reported: false,
        },
        {
          periodType: "annual",
          fiscalYear: 2026,
          periodEndDate: "2026-12-31",
          epsAvg: 12,
          analystCount: 31,
          reported: false,
        },
        {
          periodType: "annual",
          fiscalYear: 2027,
          periodEndDate: "2027-12-31",
          epsAvg: 15,
          analystCount: 30,
          reported: false,
        },
      ],
    });

    expect(result.method).toBe("fiscal_year_interpolation");
    expect(result.ntmEps).toBeCloseTo(13.25, 5);
    expect(result.fallbackReason).toBe("missing_quarterly_estimates");
  });

  it("returns stale estimates when annual candidates are gapped", () => {
    const result = calculateStockValuation({
      symbol: "GAPFY",
      valuationDate: "2026-05-06",
      price: 100,
      fiscalYearEndMonth: 12,
      estimates: [
        {
          periodType: "annual",
          fiscalYear: 2026,
          periodEndDate: "2026-12-31",
          epsAvg: 8,
          analystCount: 21,
          reported: false,
        },
        {
          periodType: "annual",
          fiscalYear: 2028,
          periodEndDate: "2028-12-31",
          epsAvg: 12,
          analystCount: 22,
          reported: false,
        },
      ],
    });

    expect(result.method).toBe("unavailable");
    expect(result.unavailableReason).toBe("stale_estimates");
    expect(result.fallbackReason).toBe("missing_quarterly_estimates");
  });

  it("returns unavailable when NTM EPS is not positive", () => {
    const result = calculateStockValuation({
      symbol: "LOSS",
      valuationDate: "2026-05-06",
      price: 40,
      fiscalYearEndMonth: 12,
      estimates: [
        {
          periodType: "annual",
          fiscalYear: 2026,
          periodEndDate: "2026-12-31",
          epsAvg: -1,
          analystCount: 3,
          reported: false,
        },
        {
          periodType: "annual",
          fiscalYear: 2027,
          periodEndDate: "2027-12-31",
          epsAvg: -0.5,
          analystCount: 3,
          reported: false,
        },
      ],
    });

    expect(result.method).toBe("unavailable");
    expect(result.unavailableReason).toBe("non_positive_ntm_eps");
  });

  it("uses included fallback annual rows for unavailable analyst count", () => {
    const result = calculateStockValuation({
      symbol: "LOSS",
      valuationDate: "2026-05-06",
      price: 40,
      fiscalYearEndMonth: 12,
      estimates: [
        {
          periodType: "quarter",
          fiscalYear: 2026,
          fiscalQuarter: 2,
          periodEndDate: "2026-06-30",
          epsAvg: null,
          analystCount: 99,
          reported: false,
        },
        {
          periodType: "annual",
          fiscalYear: 2026,
          periodEndDate: "2026-12-31",
          epsAvg: -1,
          analystCount: 3,
          reported: false,
        },
        {
          periodType: "annual",
          fiscalYear: 2027,
          periodEndDate: "2027-12-31",
          epsAvg: -0.5,
          analystCount: 5,
          reported: false,
        },
        {
          periodType: "annual",
          fiscalYear: 2028,
          periodEndDate: "2028-12-31",
          epsAvg: 20,
          analystCount: 80,
          reported: false,
        },
      ],
    });

    expect(result.method).toBe("unavailable");
    expect(result.unavailableReason).toBe("non_positive_ntm_eps");
    expect(result.analystCount).toBe(4);
  });
});

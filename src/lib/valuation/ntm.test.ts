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
});

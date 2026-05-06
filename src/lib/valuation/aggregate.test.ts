import { describe, expect, it } from "vitest";
import { calculateAggregateValuation } from "./aggregate";

describe("calculateAggregateValuation", () => {
  it("calculates aggregate forward P/E from weighted earnings yield", () => {
    const result = calculateAggregateValuation({
      symbol: "SP500",
      valuationDate: "2026-05-06",
      constituents: [
        {
          symbol: "A",
          weight: 0.6,
          price: 100,
          ntmEps: 5,
          method: "quarterly_sum",
        },
        {
          symbol: "B",
          weight: 0.4,
          price: 50,
          ntmEps: 5,
          method: "fiscal_year_interpolation",
        },
      ],
    });

    expect(result.forwardPe).toBeCloseTo(14.28571, 5);
    expect(result.earningsYield).toBeCloseTo(0.07, 5);
    expect(result.coveredWeight).toBeCloseTo(1, 5);
    expect(result.missingWeight).toBeCloseTo(0, 5);
    expect(result.quarterlySumWeight).toBeCloseTo(0.6, 5);
    expect(result.fiscalYearInterpolationWeight).toBeCloseTo(0.4, 5);
    expect(result.unavailableWeight).toBeCloseTo(0, 5);
    expect(result.constituentCount).toBe(2);
    expect(result.coveredConstituentCount).toBe(2);
    expect(result.quarterlySumCount).toBe(1);
    expect(result.fiscalYearInterpolationCount).toBe(1);
    expect(result.unavailableCount).toBe(0);
  });

  it("excludes unavailable constituents from earnings yield while preserving missing weight", () => {
    const result = calculateAggregateValuation({
      symbol: "SP500",
      valuationDate: "2026-05-06",
      constituents: [
        {
          symbol: "A",
          weight: 0.7,
          price: 100,
          ntmEps: 5,
          method: "quarterly_sum",
        },
        {
          symbol: "B",
          weight: 0.3,
          price: 50,
          ntmEps: null,
          method: "unavailable",
        },
      ],
    });

    expect(result.coveredWeight).toBeCloseTo(0.7, 5);
    expect(result.missingWeight).toBeCloseTo(0.3, 5);
    expect(result.unavailableWeight).toBeCloseTo(0.3, 5);
    expect(result.unavailableCount).toBe(1);
    expect(result.forwardPe).toBeCloseTo(28.57143, 5);
  });

  it("treats non-finite and non-positive usable values as missing without polluting earnings yield", () => {
    const result = calculateAggregateValuation({
      symbol: "SP500",
      valuationDate: "2026-05-06",
      constituents: [
        {
          symbol: "A",
          weight: 0.5,
          price: 100,
          ntmEps: 5,
          method: "quarterly_sum",
        },
        {
          symbol: "BAD_PRICE",
          weight: 0.2,
          price: Number.NaN,
          ntmEps: 5,
          method: "quarterly_sum",
        },
        {
          symbol: "BAD_EPS",
          weight: 0.2,
          price: 100,
          ntmEps: Number.POSITIVE_INFINITY,
          method: "fiscal_year_interpolation",
        },
        {
          symbol: "ZERO_WEIGHT",
          weight: 0,
          price: 100,
          ntmEps: 5,
          method: "fiscal_year_interpolation",
        },
        {
          symbol: "UNAVAILABLE",
          weight: 0.1,
          price: 100,
          ntmEps: 5,
          method: "unavailable",
        },
      ],
    });

    expect(result.earningsYield).toBeCloseTo(0.025, 5);
    expect(result.forwardPe).toBeCloseTo(40, 5);
    expect(result.coveredWeight).toBeCloseTo(0.5, 5);
    expect(result.missingWeight).toBeCloseTo(0.5, 5);
    expect(result.quarterlySumWeight).toBeCloseTo(0.5, 5);
    expect(result.fiscalYearInterpolationWeight).toBeCloseTo(0, 5);
    expect(result.unavailableWeight).toBeCloseTo(0.1, 5);
    expect(result.coveredConstituentCount).toBe(1);
    expect(result.quarterlySumCount).toBe(1);
    expect(result.fiscalYearInterpolationCount).toBe(0);
    expect(result.unavailableCount).toBe(1);
  });

  it("returns null valuation metrics when no constituents have positive earnings yield", () => {
    const result = calculateAggregateValuation({
      symbol: "SP500",
      valuationDate: "2026-05-06",
      constituents: [
        {
          symbol: "A",
          weight: 0.6,
          price: 100,
          ntmEps: 0,
          method: "quarterly_sum",
        },
        {
          symbol: "B",
          weight: 0.4,
          price: null,
          ntmEps: 5,
          method: "fiscal_year_interpolation",
        },
      ],
    });

    expect(result.earningsYield).toBeNull();
    expect(result.forwardPe).toBeNull();
    expect(result.coveredWeight).toBeCloseTo(0, 5);
    expect(result.missingWeight).toBeCloseTo(1, 5);
  });
});

import { describe, expect, it } from "vitest";
import {
  mapFmpEstimate,
  mapFmpHolding,
  mapFmpQuote,
  mapFmpSp500Constituent
} from "./mappers";

describe("FMP mappers", () => {
  it("maps annual and quarterly estimate rows", () => {
    expect(
      mapFmpEstimate(
        {
          symbol: "AAPL",
          date: "2026-09-30",
          estimatedEpsAvg: 8.5,
          estimatedEpsLow: 8.1,
          estimatedEpsHigh: 8.9,
          numberAnalystEstimatedEps: 28
        },
        "annual"
      )
    ).toEqual({
      symbol: "AAPL",
      periodType: "annual",
      fiscalYear: 2026,
      fiscalQuarter: null,
      periodEndDate: "2026-09-30",
      epsAvg: 8.5,
      epsLow: 8.1,
      epsHigh: 8.9,
      analystCount: 28,
      raw: expect.any(Object)
    });

    expect(
      mapFmpEstimate(
        {
          symbol: "MSFT",
          periodEndDate: "2026-12-31",
          estimatedEpsAvg: "3.25",
          estimatedEpsLow: "3.1",
          estimatedEpsHigh: "3.4",
          numberAnalystEstimatedEps: "18"
        },
        "quarter"
      )
    ).toMatchObject({
      symbol: "MSFT",
      periodType: "quarter",
      fiscalYear: 2026,
      fiscalQuarter: 4,
      periodEndDate: "2026-12-31",
      epsAvg: 3.25,
      epsLow: 3.1,
      epsHigh: 3.4,
      analystCount: 18
    });
  });

  it("maps nullable estimate numbers to null when they are not finite", () => {
    expect(
      mapFmpEstimate(
        {
          symbol: "AAPL",
          date: "2026-03-31",
          estimatedEpsAvg: "n/a",
          estimatedEpsLow: Number.NaN,
          estimatedEpsHigh: Infinity,
          numberAnalystEstimatedEps: undefined
        },
        "quarter"
      )
    ).toMatchObject({
      fiscalQuarter: 1,
      epsAvg: null,
      epsLow: null,
      epsHigh: null,
      analystCount: null
    });
  });

  it("rejects quarterly estimates with invalid period-end dates", () => {
    expect(() =>
      mapFmpEstimate(
        {
          symbol: "AAPL",
          date: "2026-13-31",
          estimatedEpsAvg: 2.1
        },
        "quarter"
      )
    ).toThrow("FMP quarter estimate for AAPL has invalid period end date");
  });

  it("maps quote rows", () => {
    expect(mapFmpQuote({ symbol: "AAPL", price: 220.12, volume: 1000 })).toEqual({
      symbol: "AAPL",
      price: 220.12,
      raw: expect.any(Object)
    });
  });

  it("rejects quote rows without a finite price", () => {
    expect(() => mapFmpQuote({ symbol: "AAPL", price: "n/a" })).toThrow(
      "FMP quote for AAPL is missing price"
    );
  });

  it("maps S&P 500 constituent rows", () => {
    expect(
      mapFmpSp500Constituent({
        symbol: "AAPL",
        name: "Apple Inc.",
        sector: "Technology",
        subSector: "Hardware"
      })
    ).toEqual({
      symbol: "AAPL",
      name: "Apple Inc.",
      sector: "Technology",
      raw: expect.any(Object)
    });
  });

  it("maps ETF holding rows and normalizes percent weights", () => {
    expect(mapFmpHolding({ asset: "AAPL", name: "Apple Inc.", weightPercentage: 7.5 })).toEqual({
      symbol: "AAPL",
      name: "Apple Inc.",
      weight: 0.075,
      raw: expect.any(Object)
    });
  });

  it("maps invalid ETF holding weights to zero", () => {
    expect(mapFmpHolding({ symbol: "AAPL", name: "Apple Inc.", weight: "n/a" })).toMatchObject({
      symbol: "AAPL",
      weight: 0
    });
  });
});

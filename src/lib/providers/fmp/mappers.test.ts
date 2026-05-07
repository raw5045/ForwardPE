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

  it("maps non-calendar fiscal quarter ends using explicit fiscal quarter fields", () => {
    expect(
      mapFmpEstimate(
        {
          symbol: "WMT",
          date: "2026-05-31",
          fiscalQuarter: "Q2",
          estimatedEpsAvg: 2.1
        },
        "quarter"
      )
    ).toMatchObject({
      symbol: "WMT",
      periodType: "quarter",
      fiscalYear: 2026,
      fiscalQuarter: 2,
      periodEndDate: "2026-05-31",
      epsAvg: 2.1
    });

    expect(
      mapFmpEstimate(
        {
          symbol: "COST",
          date: "2026-08-31",
          fiscalPeriod: "FY2026Q3",
          estimatedEpsAvg: 4.2
        },
        "quarter"
      )
    ).toMatchObject({
      fiscalYear: 2026,
      fiscalQuarter: 3,
      periodEndDate: "2026-08-31"
    });
  });

  it("maps fiscal year from explicit fiscal period fields", () => {
    expect(
      mapFmpEstimate(
        {
          symbol: "WMT",
          date: "2026-11-30",
          fiscalPeriod: "FY2027Q1",
          estimatedEpsAvg: 2.1
        },
        "quarter"
      )
    ).toMatchObject({
      fiscalYear: 2027,
      fiscalQuarter: 1,
      periodEndDate: "2026-11-30"
    });
  });

  it("falls back to month-based fiscal quarter without requiring quarter-end dates", () => {
    expect(
      mapFmpEstimate(
        {
          symbol: "AAPL",
          date: "2026-05-31",
          estimatedEpsAvg: 2.1
        },
        "quarter"
      )
    ).toMatchObject({
      fiscalQuarter: 2,
      periodEndDate: "2026-05-31"
    });
  });

  it("does not parse malformed estimate values as zero", () => {
    expect(
      mapFmpEstimate(
        {
          symbol: "AAPL",
          date: "2026-03-31",
          estimatedEpsAvg: false,
          estimatedEpsLow: [],
          estimatedEpsHigh: "   ",
          numberAnalystEstimatedEps: {}
        },
        "quarter"
      )
    ).toMatchObject({
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

  it("rejects quarterly estimates with impossible explicit fiscal quarters", () => {
    expect(() =>
      mapFmpEstimate(
        {
          symbol: "AAPL",
          date: "2026-05-31",
          quarter: "Q5",
          estimatedEpsAvg: 2.1
        },
        "quarter"
      )
    ).toThrow("FMP quarter estimate for AAPL has invalid fiscal quarter");

    expect(() =>
      mapFmpEstimate(
        {
          symbol: "AAPL",
          date: "2026-05-31",
          period: 0,
          estimatedEpsAvg: 2.1
        },
        "quarter"
      )
    ).toThrow("FMP quarter estimate for AAPL has invalid fiscal quarter");

    expect(() =>
      mapFmpEstimate(
        {
          symbol: "AAPL",
          date: "2026-05-31",
          fiscalPeriod: "prefix-Q1-suffix",
          estimatedEpsAvg: 2.1
        },
        "quarter"
      )
    ).toThrow("FMP quarter estimate for AAPL has invalid fiscal quarter");
  });

  it("rejects estimate rows without a symbol", () => {
    expect(() => mapFmpEstimate({ symbol: " ", date: "2026-03-31" }, "quarter")).toThrow(
      "FMP estimate is missing symbol"
    );
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

  it("rejects quote rows without a symbol", () => {
    expect(() => mapFmpQuote({ symbol: " ", price: 220.12 })).toThrow(
      "FMP quote is missing symbol"
    );

    expect(() => mapFmpQuote({ symbol: 123, price: 220.12 })).toThrow(
      "FMP quote is missing symbol"
    );
  });

  it("rejects quote prices that are malformed non-string values", () => {
    expect(() => mapFmpQuote({ symbol: "AAPL", price: false })).toThrow(
      "FMP quote for AAPL is missing price"
    );

    expect(() => mapFmpQuote({ symbol: "AAPL", price: [] })).toThrow(
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

  it("rejects S&P 500 constituent rows without required identity fields", () => {
    expect(() => mapFmpSp500Constituent({ symbol: " ", name: "Apple Inc." })).toThrow(
      "FMP S&P 500 constituent is missing symbol"
    );

    expect(() => mapFmpSp500Constituent({ symbol: "AAPL", name: " " })).toThrow(
      "FMP S&P 500 constituent for AAPL is missing name"
    );
  });

  it("maps ETF holding rows and normalizes percent weights", () => {
    expect(mapFmpHolding({ asset: "AAPL", name: "Apple Inc.", weightPercentage: 7.5 })).toEqual({
      symbol: "AAPL",
      name: "Apple Inc.",
      weight: 0.075,
      raw: expect.any(Object)
    });
  });

  it("maps missing ETF holding weights to zero", () => {
    expect(mapFmpHolding({ symbol: "AAPL", name: "Apple Inc." })).toMatchObject({
      symbol: "AAPL",
      weight: 0
    });
  });

  it("rejects present but malformed ETF holding weights", () => {
    expect(() => mapFmpHolding({ symbol: "AAPL", name: "Apple Inc.", weight: "n/a" })).toThrow(
      "FMP holding for AAPL has invalid weight"
    );

    expect(() =>
      mapFmpHolding({ symbol: "AAPL", name: "Apple Inc.", weightPercentage: false })
    ).toThrow("FMP holding for AAPL has invalid weight");
  });

  it("rejects ETF holding rows without a symbol", () => {
    expect(() => mapFmpHolding({ asset: " ", name: "Apple Inc.", weightPercentage: 7.5 })).toThrow(
      "FMP holding is missing symbol"
    );
  });

  it("preserves the raw row reference", () => {
    const row = { symbol: "AAPL", price: 220.12 };

    expect(mapFmpQuote(row).raw).toBe(row);
  });
});

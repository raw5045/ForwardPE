import type {
  CompositionProvider,
  EstimateProvider,
  PriceProvider,
  ProviderConstituent,
  ProviderEstimate,
  ProviderHolding,
  ProviderQuote
} from "../types";
import { FmpClient } from "./client";
import {
  mapFmpEstimate,
  mapFmpHolding,
  mapFmpQuote,
  mapFmpSp500Constituent
} from "./mappers";

type FmpProviderClient = {
  get(
    path: string,
    params?: Record<string, string | number | undefined>
  ): Promise<unknown>;
};

const assertFmpArrayResponse = (
  response: unknown,
  context: string
): unknown[] => {
  if (!Array.isArray(response)) {
    throw new Error(`FMP ${context} response was not an array`);
  }

  return response;
};

export class FmpProvider implements PriceProvider, EstimateProvider, CompositionProvider {
  constructor(private readonly client: FmpProviderClient = new FmpClient()) {}

  async getQuotes(symbols: string[]): Promise<ProviderQuote[]> {
    if (symbols.length === 0) {
      return [];
    }

    const response = await this.client.get("/batch-quote-short", {
      symbols: symbols.join(",")
    });
    const rows = assertFmpArrayResponse(response, `quotes for ${symbols.join(",")}`);

    return rows.map(mapFmpQuote);
  }

  async getEstimates(
    symbol: string,
    period: "annual" | "quarter"
  ): Promise<ProviderEstimate[]> {
    const response = await this.client.get("/analyst-estimates", {
      symbol,
      period,
      page: 0,
      limit: 20
    });
    const rows = assertFmpArrayResponse(
      response,
      `analyst estimates for ${symbol} ${period}`
    );

    return rows.map((row) => mapFmpEstimate(row, period));
  }

  async getSp500Constituents(): Promise<ProviderConstituent[]> {
    const response = await this.client.get("/sp500-constituent");
    const rows = assertFmpArrayResponse(response, "S&P 500 constituents");

    return rows.map(mapFmpSp500Constituent);
  }

  async getEtfHoldings(symbol: string): Promise<ProviderHolding[]> {
    const response = await this.client.get("/etf/holdings", { symbol });
    const rows = assertFmpArrayResponse(response, `ETF holdings for ${symbol}`);

    return rows.map(mapFmpHolding).filter((holding) => holding.weight > 0);
  }
}

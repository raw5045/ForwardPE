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

export class FmpProvider implements PriceProvider, EstimateProvider, CompositionProvider {
  constructor(private readonly client = new FmpClient()) {}

  async getQuotes(symbols: string[]): Promise<ProviderQuote[]> {
    if (symbols.length === 0) {
      return [];
    }

    const rows = await this.client.get<unknown[]>("/batch-quote-short", {
      symbols: symbols.join(",")
    });

    return rows.map(mapFmpQuote);
  }

  async getEstimates(
    symbol: string,
    period: "annual" | "quarter"
  ): Promise<ProviderEstimate[]> {
    const rows = await this.client.get<unknown[]>("/analyst-estimates", {
      symbol,
      period,
      page: 0,
      limit: 20
    });

    return rows.map((row) => mapFmpEstimate(row, period));
  }

  async getSp500Constituents(): Promise<ProviderConstituent[]> {
    const rows = await this.client.get<unknown[]>("/sp500-constituent");

    return rows.map(mapFmpSp500Constituent);
  }

  async getEtfHoldings(symbol: string): Promise<ProviderHolding[]> {
    const rows = await this.client.get<unknown[]>("/etf/holdings", { symbol });

    return rows.map(mapFmpHolding).filter((holding) => holding.weight > 0);
  }
}

export type ProviderSource = "fmp";

export type ProviderQuote = {
  symbol: string;
  price: number;
  raw: unknown;
};

export type ProviderEstimate = {
  symbol: string;
  periodType: "quarter" | "annual";
  fiscalYear: number;
  fiscalQuarter: number | null;
  periodEndDate: string;
  epsAvg: number | null;
  epsLow: number | null;
  epsHigh: number | null;
  analystCount: number | null;
  raw: unknown;
};

export type ProviderConstituent = {
  symbol: string;
  name: string;
  sector: string | null;
  raw: unknown;
};

export type ProviderHolding = {
  symbol: string;
  name: string | null;
  weight: number;
  raw: unknown;
};

export type PriceProvider = {
  getQuotes(symbols: string[]): Promise<ProviderQuote[]>;
};

export type EstimateProvider = {
  getEstimates(symbol: string, period: "annual" | "quarter"): Promise<ProviderEstimate[]>;
};

export type CompositionProvider = {
  getSp500Constituents(): Promise<ProviderConstituent[]>;
  getEtfHoldings(symbol: string): Promise<ProviderHolding[]>;
};

import type {
  CompositionProvider,
  EstimateProvider,
  PriceProvider,
  ProviderEstimate,
} from "../providers/types";
import type {
  AggregateValuationResult,
  StockValuationResult,
  ValuationMethod,
} from "../valuation/types";

export type IngestionProvider = PriceProvider &
  EstimateProvider &
  CompositionProvider;

export type IngestionRepository = {
  startIngestionRun(input: { runDate: string; kind: string }): Promise<string>;
  finishIngestionRun(runId: string, details: unknown): Promise<void>;
  failIngestionRun(runId: string, error: string): Promise<void>;
  upsertInstrument(input: {
    symbol: string;
    name: string;
    type: "stock" | "etf" | "index" | "synthetic";
    exchange?: string | null;
    sector?: string | null;
    active?: boolean;
  }): Promise<void>;
  upsertGroup(input: { slug: string; name: string; type: string }): Promise<void>;
  upsertGroupMembership(input: {
    groupSlug: string;
    symbol: string;
    effectiveDate: string;
    weight?: number | null;
    source: string;
    raw?: unknown;
  }): Promise<void>;
  upsertPriceSnapshot(input: {
    symbol: string;
    snapshotDate: string;
    price: number;
    source: string;
    raw: unknown;
  }): Promise<void>;
  upsertEstimateSnapshot(input: {
    symbol: string;
    snapshotDate: string;
    estimate: ProviderEstimate;
    source: string;
  }): Promise<void>;
  upsertCompositionSnapshot(input: {
    parentSymbol: string;
    childSymbol: string;
    snapshotDate: string;
    weight: number;
    source: string;
    raw: unknown;
  }): Promise<void>;
  upsertValuationSnapshot(input: {
    symbol: string;
    snapshotDate: string;
    valuation: StockValuationResult | AggregateValuationResult;
    source: string;
  }): Promise<void>;
  getLatestGroupConstituents(
    groupSlug: string,
  ): Promise<Array<{ symbol: string; weight: number }>>;
  getLatestStockValuations(
    snapshotDate: string,
    symbols: string[],
  ): Promise<
    Array<{
      symbol: string;
      price: number | null;
      ntmEps: number | null;
      method: ValuationMethod;
    }>
  >;
};

export type IngestionResult = {
  status: "succeeded" | "partial" | "failed";
  runId: string;
  runDate: string;
  symbolsProcessed: number;
  errors: string[];
};

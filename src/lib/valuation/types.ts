export type ValuationMethod =
  | "quarterly_sum"
  | "fiscal_year_interpolation"
  | "unavailable";

export type UnavailableReason =
  | "missing_price"
  | "missing_quarterly_estimates"
  | "missing_annual_estimates"
  | "non_positive_ntm_eps"
  | "stale_estimates";

export type EstimateInput = {
  periodType: "quarter" | "annual";
  fiscalYear: number;
  fiscalQuarter?: number;
  periodEndDate: string;
  epsAvg: number | null;
  analystCount?: number | null;
  reported: boolean;
};

export type StockValuationInput = {
  symbol: string;
  valuationDate: string;
  price: number | null;
  fiscalYearEndMonth: number;
  estimates: EstimateInput[];
};

export type StockValuationResult =
  | {
      symbol: string;
      method: "quarterly_sum" | "fiscal_year_interpolation";
      price: number;
      ntmEps: number;
      earningsYield: number;
      forwardPe: number;
      estimatePeriods: string[];
      analystCount: number | null;
      fallbackReason?: "missing_quarterly_estimates";
      unavailableReason?: never;
    }
  | {
      symbol: string;
      method: "unavailable";
      price: number | null;
      ntmEps: null;
      earningsYield: null;
      forwardPe: null;
      estimatePeriods: string[];
      analystCount: number | null;
      fallbackReason?: "missing_quarterly_estimates";
      unavailableReason: UnavailableReason;
    };

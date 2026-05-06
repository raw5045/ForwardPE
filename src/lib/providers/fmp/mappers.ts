import type {
  ProviderConstituent,
  ProviderEstimate,
  ProviderHolding,
  ProviderQuote
} from "../types";

type FmpRow = Record<string, unknown>;

const toRecord = (row: unknown): FmpRow => {
  if (row && typeof row === "object") {
    return row as FmpRow;
  }

  return {};
};

const toStringValue = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
};

const toNullableFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const toRequiredFiniteNumber = (value: unknown): number | null => {
  const numberValue = toNullableFiniteNumber(value);
  return numberValue === null ? null : numberValue;
};

const parsePeriodEndDate = (row: FmpRow, symbol: string, periodType: "annual" | "quarter") => {
  const periodEndDate = toStringValue(row.periodEndDate ?? row.date);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(periodEndDate);

  if (!match) {
    throw new Error(`FMP ${periodType} estimate for ${symbol} has invalid period end date`);
  }

  const fiscalYear = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsedDate = new Date(Date.UTC(fiscalYear, month - 1, day));

  if (
    parsedDate.getUTCFullYear() !== fiscalYear ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    throw new Error(`FMP ${periodType} estimate for ${symbol} has invalid period end date`);
  }

  return { fiscalYear, month, periodEndDate };
};

const fiscalQuarterFromMonth = (month: number, symbol: string): number => {
  const fiscalQuarter = Math.ceil(month / 3);

  if (!Number.isInteger(fiscalQuarter) || fiscalQuarter < 1 || fiscalQuarter > 4) {
    throw new Error(`FMP quarter estimate for ${symbol} has invalid fiscal quarter`);
  }

  return fiscalQuarter;
};

export const mapFmpEstimate = (
  row: unknown,
  periodType: "annual" | "quarter"
): ProviderEstimate => {
  const raw = row;
  const record = toRecord(row);
  const symbol = toStringValue(record.symbol);
  const { fiscalYear, month, periodEndDate } = parsePeriodEndDate(record, symbol, periodType);

  return {
    symbol,
    periodType,
    fiscalYear,
    fiscalQuarter: periodType === "annual" ? null : fiscalQuarterFromMonth(month, symbol),
    periodEndDate,
    epsAvg: toNullableFiniteNumber(record.estimatedEpsAvg),
    epsLow: toNullableFiniteNumber(record.estimatedEpsLow),
    epsHigh: toNullableFiniteNumber(record.estimatedEpsHigh),
    analystCount: toNullableFiniteNumber(record.numberAnalystEstimatedEps),
    raw
  };
};

export const mapFmpQuote = (row: unknown): ProviderQuote => {
  const raw = row;
  const record = toRecord(row);
  const symbol = toStringValue(record.symbol);
  const price = toRequiredFiniteNumber(record.price);

  if (price === null) {
    throw new Error(`FMP quote for ${symbol} is missing price`);
  }

  return {
    symbol,
    price,
    raw
  };
};

export const mapFmpSp500Constituent = (row: unknown): ProviderConstituent => {
  const raw = row;
  const record = toRecord(row);

  return {
    symbol: toStringValue(record.symbol),
    name: toStringValue(record.name),
    sector: toStringValue(record.sector) || null,
    raw
  };
};

export const mapFmpHolding = (row: unknown): ProviderHolding => {
  const raw = row;
  const record = toRecord(row);
  const weightPercent = toNullableFiniteNumber(record.weightPercentage ?? record.weight);

  return {
    symbol: toStringValue(record.asset ?? record.symbol),
    name: toStringValue(record.name) || null,
    weight: weightPercent === null ? 0 : weightPercent / 100,
    raw
  };
};

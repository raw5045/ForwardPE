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
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
};

const toNullableFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (trimmedValue === "") {
    return null;
  }

  const numberValue = Number(trimmedValue);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const isPresent = (value: unknown): boolean => value !== null && value !== undefined;

const isNumberLike = (value: unknown): boolean => {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value !== "string") {
    return false;
  }

  const trimmedValue = value.trim();
  return trimmedValue !== "" && Number.isFinite(Number(trimmedValue));
};

const requireString = (value: unknown, missingMessage: string): string => {
  const stringValue = typeof value === "string" ? value.trim() : "";

  if (stringValue === "") {
    throw new Error(missingMessage);
  }

  return stringValue;
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

const isQuarterEndDate = (month: number, day: number): boolean =>
  (month === 3 && day === 31) ||
  (month === 6 && day === 30) ||
  (month === 9 && day === 30) ||
  (month === 12 && day === 31);

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
  const symbol = requireString(record.symbol, "FMP estimate is missing symbol");
  const { fiscalYear, month, periodEndDate } = parsePeriodEndDate(record, symbol, periodType);
  const day = Number(periodEndDate.slice(8, 10));

  if (periodType === "quarter" && !isQuarterEndDate(month, day)) {
    throw new Error(`FMP quarter estimate for ${symbol} has invalid quarter end date`);
  }

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
  const symbol = requireString(record.symbol, "FMP quote is missing symbol");
  const price = toNullableFiniteNumber(record.price);

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
  const symbol = requireString(record.symbol, "FMP S&P 500 constituent is missing symbol");
  const name = requireString(
    record.name,
    `FMP S&P 500 constituent for ${symbol} is missing name`
  );

  return {
    symbol,
    name,
    sector: toStringValue(record.sector) || null,
    raw
  };
};

export const mapFmpHolding = (row: unknown): ProviderHolding => {
  const raw = row;
  const record = toRecord(row);
  const symbol = requireString(record.asset ?? record.symbol, "FMP holding is missing symbol");
  const weightValue = record.weightPercentage ?? record.weight;
  const weightPercent = toNullableFiniteNumber(weightValue);

  if (isPresent(weightValue) && !isNumberLike(weightValue)) {
    throw new Error(`FMP holding for ${symbol} has invalid weight`);
  }

  return {
    symbol,
    name: toStringValue(record.name) || null,
    weight: weightPercent === null ? 0 : weightPercent / 100,
    raw
  };
};

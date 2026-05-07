import { sql, type SQL } from "drizzle-orm";
import { createDb } from "../../db/client";

export type IngestionRunRow = {
  id: string;
  runDate: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
};

export type MethodMixRow = {
  symbol: string;
  snapshotDate: string;
  quarterlySumCount: number;
  fiscalYearInterpolationCount: number;
  unavailableCount: number;
  quarterlySumWeight: number;
  fiscalYearInterpolationWeight: number;
  unavailableWeight: number;
};

type QueryDb = {
  execute: (query: SQL) => Promise<unknown>;
};

type RawIngestionRunRow = {
  id: unknown;
  runDate: unknown;
  status: unknown;
  startedAt: unknown;
  finishedAt: unknown;
  error: unknown;
};

type RawMethodMixRow = {
  symbol: unknown;
  snapshotDate: unknown;
  quarterlySumCount: unknown;
  fiscalYearInterpolationCount: unknown;
  unavailableCount: unknown;
  quarterlySumWeight: unknown;
  fiscalYearInterpolationWeight: unknown;
  unavailableWeight: unknown;
};

async function runRows<T>(db: QueryDb, statement: SQL): Promise<T[]> {
  const result = await db.execute(statement);

  if (Array.isArray(result)) {
    return result as T[];
  }

  if (
    typeof result === "object" &&
    result !== null &&
    "rows" in result &&
    Array.isArray(result.rows)
  ) {
    return result.rows as T[];
  }

  return [];
}

function toNullableNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }

  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toNumber(value: unknown): number {
  return toNullableNumber(value) ?? 0;
}

function toDateString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value);
}

function toTimestampString(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function mapIngestionRunRow(row: RawIngestionRunRow): IngestionRunRow {
  return {
    id: String(row.id),
    runDate: toDateString(row.runDate),
    status: String(row.status),
    startedAt: toTimestampString(row.startedAt) ?? "",
    finishedAt: toTimestampString(row.finishedAt),
    error: row.error == null ? null : String(row.error),
  };
}

function mapMethodMixRow(row: RawMethodMixRow): MethodMixRow {
  return {
    symbol: String(row.symbol),
    snapshotDate: toDateString(row.snapshotDate),
    quarterlySumCount: toNumber(row.quarterlySumCount),
    fiscalYearInterpolationCount: toNumber(
      row.fiscalYearInterpolationCount,
    ),
    unavailableCount: toNumber(row.unavailableCount),
    quarterlySumWeight: toNumber(row.quarterlySumWeight),
    fiscalYearInterpolationWeight: toNumber(
      row.fiscalYearInterpolationWeight,
    ),
    unavailableWeight: toNumber(row.unavailableWeight),
  };
}

function normalizeLimit(limit: number | undefined) {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return 10;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

export async function getRecentIngestionRuns(
  limit?: number,
): Promise<IngestionRunRow[]> {
  const db = createDb();
  const rows = await runRows<RawIngestionRunRow>(
    db,
    sql`
      select
        id as "id",
        run_date as "runDate",
        status::text as "status",
        started_at as "startedAt",
        finished_at as "finishedAt",
        error as "error"
      from ingestion_runs
      order by
        run_date desc,
        started_at desc,
        id desc
      limit ${normalizeLimit(limit)}
    `,
  );

  return rows.map(mapIngestionRunRow);
}

export async function getLatestMethodMix(): Promise<MethodMixRow[]> {
  const db = createDb();
  const rows = await runRows<RawMethodMixRow>(
    db,
    sql`
      with latest_aggregates as (
        select
          v.*,
          row_number() over (
            partition by v.instrument_id
            order by
              v.snapshot_date desc,
              v.updated_at desc,
              v.created_at desc,
              v.id desc
          ) as row_number
        from valuation_snapshots v
        where v.method = 'aggregate'
      )
      select
        i.symbol as "symbol",
        v.snapshot_date as "snapshotDate",
        coalesce(v.quarterly_sum_count, 0) as "quarterlySumCount",
        coalesce(v.fiscal_year_interpolation_count, 0) as "fiscalYearInterpolationCount",
        coalesce(v.unavailable_count, 0) as "unavailableCount",
        coalesce(v.quarterly_sum_weight, 0) as "quarterlySumWeight",
        coalesce(v.fiscal_year_interpolation_weight, 0) as "fiscalYearInterpolationWeight",
        coalesce(v.unavailable_weight, 0) as "unavailableWeight"
      from latest_aggregates v
      inner join instruments i on i.id = v.instrument_id
      where v.row_number = 1
      order by i.symbol asc
    `,
  );

  return rows.map(mapMethodMixRow);
}

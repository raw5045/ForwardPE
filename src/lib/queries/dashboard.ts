import { sql, type SQL } from "drizzle-orm";
import { createDb } from "../../db/client";
import { sectorEtfs } from "../universe/defaults";

export type DashboardInstrumentRow = {
  symbol: string;
  name: string;
  type: string;
  price: number | null;
  ntmEps: number | null;
  forwardPe: number | null;
  method: string;
  coveredWeight: number | null;
  quarterlySumWeight: number | null;
  fiscalYearInterpolationWeight: number | null;
  unavailableWeight: number | null;
  snapshotDate: string | null;
};

export type ValuationHistoryPoint = {
  snapshotDate: string;
  forwardPe: number | null;
  ntmEps: number | null;
  price: number | null;
};

type QueryDb = {
  execute: (query: SQL) => Promise<unknown>;
};

type RawDashboardInstrumentRow = {
  symbol: unknown;
  name: unknown;
  type: unknown;
  price: unknown;
  ntmEps: unknown;
  forwardPe: unknown;
  method: unknown;
  coveredWeight: unknown;
  quarterlySumWeight: unknown;
  fiscalYearInterpolationWeight: unknown;
  unavailableWeight: unknown;
  snapshotDate: unknown;
};

type RawValuationHistoryPoint = {
  snapshotDate: unknown;
  forwardPe: unknown;
  ntmEps: unknown;
  price: unknown;
};

const overviewSymbols = ["SP500", "NDX", "QQQ", ...sectorEtfs];

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

function toDateString(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value);
}

function mapDashboardInstrumentRow(
  row: RawDashboardInstrumentRow,
): DashboardInstrumentRow {
  return {
    symbol: String(row.symbol),
    name: String(row.name),
    type: String(row.type),
    price: toNullableNumber(row.price),
    ntmEps: toNullableNumber(row.ntmEps),
    forwardPe: toNullableNumber(row.forwardPe),
    method: String(row.method),
    coveredWeight: toNullableNumber(row.coveredWeight),
    quarterlySumWeight: toNullableNumber(row.quarterlySumWeight),
    fiscalYearInterpolationWeight: toNullableNumber(
      row.fiscalYearInterpolationWeight,
    ),
    unavailableWeight: toNullableNumber(row.unavailableWeight),
    snapshotDate: toDateString(row.snapshotDate),
  };
}

function mapValuationHistoryPoint(
  row: RawValuationHistoryPoint,
): ValuationHistoryPoint {
  return {
    snapshotDate: toDateString(row.snapshotDate) ?? "",
    forwardPe: toNullableNumber(row.forwardPe),
    ntmEps: toNullableNumber(row.ntmEps),
    price: toNullableNumber(row.price),
  };
}

function dashboardRowSelect() {
  return sql`
    i.symbol as "symbol",
    i.name as "name",
    i.type::text as "type",
    v.price as "price",
    v.ntm_eps as "ntmEps",
    v.forward_pe as "forwardPe",
    v.method::text as "method",
    v.covered_weight as "coveredWeight",
    v.quarterly_sum_weight as "quarterlySumWeight",
    v.fiscal_year_interpolation_weight as "fiscalYearInterpolationWeight",
    v.unavailable_weight as "unavailableWeight",
    v.snapshot_date as "snapshotDate"
  `;
}

export async function getOverviewRows(): Promise<DashboardInstrumentRow[]> {
  const db = createDb();
  const overviewValues = sql.join(
    overviewSymbols.map(
      (symbol, index) => sql`(${symbol}, cast(${index} as integer))`,
    ),
    sql`, `,
  );
  const rows = await runRows<RawDashboardInstrumentRow>(
    db,
    sql`
      with overview_symbols(symbol, sort_order) as (
        values ${overviewValues}
      ),
      latest_valuations as (
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
        where v.source = 'fmp_consensus_ntm_private'
      )
      select ${dashboardRowSelect()}
      from overview_symbols o
      inner join instruments i on i.symbol = o.symbol
      inner join latest_valuations v
        on v.instrument_id = i.id
       and v.row_number = 1
      where i.active = true
      order by o.sort_order asc
    `,
  );

  return rows.map(mapDashboardInstrumentRow);
}

export async function getInstrumentDetail(
  symbol: string,
): Promise<{
  row: DashboardInstrumentRow | null;
  history: ValuationHistoryPoint[];
}> {
  const db = createDb();
  const normalizedSymbol = symbol.trim().toUpperCase();
  const latestRows = await runRows<RawDashboardInstrumentRow>(
    db,
    sql`
      with latest_valuations as (
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
        where v.source = 'fmp_consensus_ntm_private'
      )
      select ${dashboardRowSelect()}
      from instruments i
      inner join latest_valuations v
        on v.instrument_id = i.id
       and v.row_number = 1
      where i.symbol = ${normalizedSymbol}
      limit 1
    `,
  );
  const historyRows = await runRows<RawValuationHistoryPoint>(
    db,
    sql`
      with dated_valuations as (
        select
          v.*,
          row_number() over (
            partition by v.instrument_id, v.snapshot_date
            order by
              v.updated_at desc,
              v.created_at desc,
              v.id desc
          ) as row_number
        from valuation_snapshots v
        inner join instruments i on i.id = v.instrument_id
        where i.symbol = ${normalizedSymbol}
          and v.source = 'fmp_consensus_ntm_private'
      )
      select
        v.snapshot_date as "snapshotDate",
        v.forward_pe as "forwardPe",
        v.ntm_eps as "ntmEps",
        v.price as "price"
      from dated_valuations v
      where v.row_number = 1
      order by v.snapshot_date asc
    `,
  );

  return {
    row: latestRows[0] ? mapDashboardInstrumentRow(latestRows[0]) : null,
    history: historyRows.map(mapValuationHistoryPoint),
  };
}

export async function getSp500Rows(): Promise<DashboardInstrumentRow[]> {
  const db = createDb();
  const rows = await runRows<RawDashboardInstrumentRow>(
    db,
    sql`
      with latest_sp500_effective_date as (
        select
          gm.group_id,
          max(gm.effective_date) as effective_date
        from group_memberships gm
        inner join instrument_groups g on g.id = gm.group_id
        where g.slug = 'sp500'
        group by gm.group_id
      ),
      latest_sp500_memberships as (
        select gm.instrument_id
        from group_memberships gm
        inner join latest_sp500_effective_date latest
          on latest.group_id = gm.group_id
         and latest.effective_date = gm.effective_date
      ),
      latest_valuations as (
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
        where v.method <> 'aggregate'
          and v.source = 'fmp_consensus_ntm_private'
      )
      select ${dashboardRowSelect()}
      from latest_sp500_memberships m
      inner join instruments i on i.id = m.instrument_id
      inner join latest_valuations v
        on v.instrument_id = i.id
       and v.row_number = 1
      where i.type = 'stock'
        and i.active = true
      order by i.symbol asc
    `,
  );

  return rows.map(mapDashboardInstrumentRow);
}

import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const instrumentTypeEnum = pgEnum("instrument_type", ["stock", "etf", "index", "synthetic"]);
export const estimatePeriodTypeEnum = pgEnum("estimate_period_type", ["quarter", "annual"]);
export const valuationMethodEnum = pgEnum("valuation_method", [
  "quarterly_sum",
  "fiscal_year_interpolation",
  "unavailable",
  "aggregate",
]);
export const valuationSourceEnum = pgEnum("valuation_source", [
  "fmp_consensus_ntm_private",
  "public_model_ntm",
  "manual_override",
  "vendor_display_license",
]);
export const ingestionStatusEnum = pgEnum("ingestion_status", ["running", "succeeded", "failed", "partial"]);

const createdAt = timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();

export const instruments = pgTable(
  "instruments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    symbol: text("symbol").notNull(),
    name: text("name").notNull(),
    type: instrumentTypeEnum("type").notNull(),
    exchange: text("exchange"),
    sector: text("sector"),
    active: boolean("active").default(true).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [unique("instruments_symbol_unique").on(table.symbol)],
);

export const instrumentGroups = pgTable(
  "instrument_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [unique("instrument_groups_slug_unique").on(table.slug)],
);

export const groupMemberships = pgTable(
  "group_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => instrumentGroups.id),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id),
    effectiveDate: date("effective_date").notNull(),
    weight: numeric("weight"),
    source: text("source").notNull(),
    raw: jsonb("raw"),
    createdAt,
    updatedAt,
  },
  (table) => [unique("group_membership_effective_unique").on(table.groupId, table.instrumentId, table.effectiveDate)],
);

export const priceSnapshots = pgTable(
  "price_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id),
    snapshotDate: date("snapshot_date").notNull(),
    price: numeric("price").notNull(),
    source: text("source").notNull(),
    raw: jsonb("raw"),
    createdAt,
    updatedAt,
  },
  (table) => [unique("price_snapshot_unique").on(table.instrumentId, table.snapshotDate, table.source)],
);

export const estimateSnapshots = pgTable(
  "estimate_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id),
    snapshotDate: date("snapshot_date").notNull(),
    periodType: estimatePeriodTypeEnum("period_type").notNull(),
    fiscalYear: integer("fiscal_year").notNull(),
    fiscalQuarter: integer("fiscal_quarter"),
    periodEndDate: date("period_end_date").notNull(),
    epsAvg: numeric("eps_avg"),
    epsLow: numeric("eps_low"),
    epsHigh: numeric("eps_high"),
    analystCount: integer("analyst_count"),
    source: text("source").notNull(),
    raw: jsonb("raw"),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("estimate_snapshot_unique").on(
      table.instrumentId,
      table.snapshotDate,
      table.periodType,
      table.fiscalYear,
      table.fiscalQuarter,
      table.source,
    ),
  ],
);

export const compositionSnapshots = pgTable(
  "composition_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parentInstrumentId: uuid("parent_instrument_id")
      .notNull()
      .references(() => instruments.id),
    childInstrumentId: uuid("child_instrument_id")
      .notNull()
      .references(() => instruments.id),
    snapshotDate: date("snapshot_date").notNull(),
    weight: numeric("weight").notNull(),
    source: text("source").notNull(),
    raw: jsonb("raw"),
    createdAt,
    updatedAt,
  },
  (table) => [
    unique("composition_snapshot_unique").on(
      table.parentInstrumentId,
      table.childInstrumentId,
      table.snapshotDate,
      table.source,
    ),
  ],
);

export const valuationSnapshots = pgTable(
  "valuation_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id),
    snapshotDate: date("snapshot_date").notNull(),
    method: valuationMethodEnum("method").notNull(),
    source: valuationSourceEnum("source").notNull(),
    price: numeric("price"),
    ntmEps: numeric("ntm_eps"),
    earningsYield: numeric("earnings_yield"),
    forwardPe: numeric("forward_pe"),
    estimatePeriods: jsonb("estimate_periods"),
    analystCount: integer("analyst_count"),
    fallbackReason: text("fallback_reason"),
    unavailableReason: text("unavailable_reason"),
    coveredWeight: numeric("covered_weight"),
    missingWeight: numeric("missing_weight"),
    quarterlySumWeight: numeric("quarterly_sum_weight"),
    fiscalYearInterpolationWeight: numeric("fiscal_year_interpolation_weight"),
    unavailableWeight: numeric("unavailable_weight"),
    constituentCount: integer("constituent_count"),
    coveredConstituentCount: integer("covered_constituent_count"),
    quarterlySumCount: integer("quarterly_sum_count"),
    fiscalYearInterpolationCount: integer("fiscal_year_interpolation_count"),
    unavailableCount: integer("unavailable_count"),
    createdAt,
    updatedAt,
  },
  (table) => [unique("valuation_snapshot_unique").on(table.instrumentId, table.snapshotDate, table.method, table.source)],
);

export const ingestionRuns = pgTable("ingestion_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  runDate: date("run_date").notNull(),
  kind: text("kind").notNull(),
  status: ingestionStatusEnum("status").default("running").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  details: jsonb("details"),
  error: text("error"),
});

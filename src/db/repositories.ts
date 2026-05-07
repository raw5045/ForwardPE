import { and, desc, eq, inArray } from "drizzle-orm";
import type { ProviderEstimate } from "../lib/providers/types";
import type {
  AggregateValuationResult,
  StockValuationResult,
  ValuationMethod,
} from "../lib/valuation/types";
import type { DbClient } from "./client";
import {
  compositionSnapshots,
  estimateSnapshots,
  groupMemberships,
  ingestionRuns,
  instrumentGroups,
  instruments,
  priceSnapshots,
  valuationSnapshots,
} from "./schema";

export type SnapshotDate = string;

export type UpsertInstrumentInput = {
  symbol: string;
  name: string;
  type: "stock" | "etf" | "index" | "synthetic";
  exchange?: string | null;
  sector?: string | null;
  active?: boolean;
};

type UpsertGroupMembershipInput = {
  groupSlug: string;
  symbol: string;
  effectiveDate: string;
  weight?: number | null;
  source: string;
  raw?: unknown;
};

type UpsertPriceSnapshotInput = {
  symbol: string;
  snapshotDate: string;
  price: number;
  source: string;
  raw: unknown;
};

type UpsertEstimateSnapshotInput = {
  symbol: string;
  snapshotDate: string;
  estimate: ProviderEstimate;
  source: string;
};

type UpsertCompositionSnapshotInput = {
  parentSymbol: string;
  childSymbol: string;
  snapshotDate: string;
  weight: number;
  source: string;
  raw: unknown;
};

type UpsertValuationSnapshotInput = {
  symbol: string;
  snapshotDate: string;
  valuation: StockValuationResult | AggregateValuationResult;
  source: string;
};

const valuationSnapshotSources = [
  "fmp_consensus_ntm_private",
  "public_model_ntm",
  "manual_override",
  "vendor_display_license",
] as const;

type ValuationSnapshotSource = (typeof valuationSnapshotSources)[number];

function toNumeric(value: number | null | undefined) {
  if (value == null) {
    return null;
  }

  return Number.isFinite(value) ? value.toString() : null;
}

function toRequiredNumeric(value: number) {
  if (!Number.isFinite(value)) {
    throw new Error(`Expected finite numeric value, received ${value}`);
  }

  return value.toString();
}

function fromNumeric(value: string | number | null) {
  if (value == null) {
    return null;
  }

  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function isPositiveFiniteNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isStockValuationMethod(method: string): method is ValuationMethod {
  return (
    method === "quarterly_sum" ||
    method === "fiscal_year_interpolation" ||
    method === "unavailable"
  );
}

function mapValuationSource(source: string): ValuationSnapshotSource {
  if (source === "fmp") {
    return "fmp_consensus_ntm_private";
  }

  if (
    valuationSnapshotSources.includes(source as ValuationSnapshotSource)
  ) {
    return source as ValuationSnapshotSource;
  }

  throw new Error(`Unsupported valuation source "${source}"`);
}

function getFinishedIngestionStatus(details: unknown) {
  if (
    typeof details === "object" &&
    details !== null &&
    "status" in details &&
    details.status === "partial"
  ) {
    return "partial";
  }

  return "succeeded";
}

export class ForwardPeRepository {
  constructor(private readonly db: DbClient) {}

  private async getInstrumentId(symbol: string, context: string) {
    const [instrument] = await this.db
      .select({ id: instruments.id })
      .from(instruments)
      .where(eq(instruments.symbol, symbol))
      .limit(1);

    if (!instrument) {
      throw new Error(`Cannot ${context}: instrument "${symbol}" does not exist`);
    }

    return instrument.id;
  }

  async upsertInstrument(input: UpsertInstrumentInput): Promise<void> {
    const now = new Date();
    const updateSet: Partial<typeof instruments.$inferInsert> = {
      name: input.name,
      type: input.type,
      updatedAt: now,
    };
    if ("exchange" in input) {
      updateSet.exchange = input.exchange ?? null;
    }
    if ("sector" in input) {
      updateSet.sector = input.sector ?? null;
    }
    if ("active" in input) {
      updateSet.active = input.active ?? true;
    }

    await this.db
      .insert(instruments)
      .values({
        symbol: input.symbol,
        name: input.name,
        type: input.type,
        exchange: input.exchange ?? null,
        sector: input.sector ?? null,
        active: input.active ?? true,
      })
      .onConflictDoUpdate({
        target: instruments.symbol,
        set: updateSet,
      });
  }

  async startIngestionRun(input: {
    runDate: string;
    kind: string;
  }): Promise<string> {
    const [run] = await this.db
      .insert(ingestionRuns)
      .values({
        runDate: input.runDate,
        kind: input.kind,
        status: "running",
      })
      .returning({ id: ingestionRuns.id });

    if (!run) {
      throw new Error("Failed to create ingestion run");
    }

    return run.id;
  }

  async finishIngestionRun(runId: string, details: unknown): Promise<void> {
    await this.db
      .update(ingestionRuns)
      .set({
        status: getFinishedIngestionStatus(details),
        finishedAt: new Date(),
        details,
        error: null,
      })
      .where(eq(ingestionRuns.id, runId));
  }

  async failIngestionRun(runId: string, error: string): Promise<void> {
    await this.db
      .update(ingestionRuns)
      .set({
        status: "failed",
        finishedAt: new Date(),
        error,
      })
      .where(eq(ingestionRuns.id, runId));
  }

  async upsertGroup(input: { slug: string; name: string; type: string }): Promise<void> {
    const now = new Date();

    await this.db
      .insert(instrumentGroups)
      .values({
        slug: input.slug,
        name: input.name,
        type: input.type,
      })
      .onConflictDoUpdate({
        target: instrumentGroups.slug,
        set: {
          name: input.name,
          type: input.type,
          updatedAt: now,
        },
      });
  }

  async upsertGroupMembership(input: UpsertGroupMembershipInput): Promise<void> {
    const [group] = await this.db
      .select({ id: instrumentGroups.id })
      .from(instrumentGroups)
      .where(eq(instrumentGroups.slug, input.groupSlug))
      .limit(1);
    if (!group) {
      throw new Error(`Cannot upsert group membership: group "${input.groupSlug}" does not exist`);
    }

    const [instrument] = await this.db
      .select({ id: instruments.id })
      .from(instruments)
      .where(eq(instruments.symbol, input.symbol))
      .limit(1);
    if (!instrument) {
      throw new Error(`Cannot upsert group membership: instrument "${input.symbol}" does not exist`);
    }

    const weight = toNumeric(input.weight);
    const now = new Date();

    await this.db
      .insert(groupMemberships)
      .values({
        groupId: group.id,
        instrumentId: instrument.id,
        effectiveDate: input.effectiveDate,
        weight,
        source: input.source,
        raw: input.raw ?? null,
      })
      .onConflictDoUpdate({
        target: [groupMemberships.groupId, groupMemberships.instrumentId, groupMemberships.effectiveDate],
        set: {
          weight,
          source: input.source,
          raw: input.raw ?? null,
          updatedAt: now,
        },
      });
  }

  async upsertPriceSnapshot(input: UpsertPriceSnapshotInput): Promise<void> {
    const instrumentId = await this.getInstrumentId(
      input.symbol,
      "upsert price snapshot",
    );
    const price = toRequiredNumeric(input.price);
    const now = new Date();

    await this.db
      .insert(priceSnapshots)
      .values({
        instrumentId,
        snapshotDate: input.snapshotDate,
        price,
        source: input.source,
        raw: input.raw ?? null,
      })
      .onConflictDoUpdate({
        target: [
          priceSnapshots.instrumentId,
          priceSnapshots.snapshotDate,
          priceSnapshots.source,
        ],
        set: {
          price,
          raw: input.raw ?? null,
          updatedAt: now,
        },
      });
  }

  async upsertEstimateSnapshot(input: UpsertEstimateSnapshotInput): Promise<void> {
    const instrumentId = await this.getInstrumentId(
      input.symbol,
      "upsert estimate snapshot",
    );
    const estimate = input.estimate;
    const fiscalQuarter = estimate.fiscalQuarter ?? 0;
    const now = new Date();

    await this.db
      .insert(estimateSnapshots)
      .values({
        instrumentId,
        snapshotDate: input.snapshotDate,
        periodType: estimate.periodType,
        fiscalYear: estimate.fiscalYear,
        fiscalQuarter,
        periodEndDate: estimate.periodEndDate,
        epsAvg: toNumeric(estimate.epsAvg),
        epsLow: toNumeric(estimate.epsLow),
        epsHigh: toNumeric(estimate.epsHigh),
        analystCount: estimate.analystCount,
        source: input.source,
        raw: estimate.raw ?? null,
      })
      .onConflictDoUpdate({
        target: [
          estimateSnapshots.instrumentId,
          estimateSnapshots.snapshotDate,
          estimateSnapshots.periodType,
          estimateSnapshots.fiscalYear,
          estimateSnapshots.fiscalQuarter,
          estimateSnapshots.source,
        ],
        set: {
          periodEndDate: estimate.periodEndDate,
          epsAvg: toNumeric(estimate.epsAvg),
          epsLow: toNumeric(estimate.epsLow),
          epsHigh: toNumeric(estimate.epsHigh),
          analystCount: estimate.analystCount,
          raw: estimate.raw ?? null,
          updatedAt: now,
        },
      });
  }

  async upsertCompositionSnapshot(
    input: UpsertCompositionSnapshotInput,
  ): Promise<void> {
    const parentInstrumentId = await this.getInstrumentId(
      input.parentSymbol,
      "upsert composition snapshot",
    );
    const childInstrumentId = await this.getInstrumentId(
      input.childSymbol,
      "upsert composition snapshot",
    );
    const weight = toRequiredNumeric(input.weight);
    const now = new Date();

    await this.db
      .insert(compositionSnapshots)
      .values({
        parentInstrumentId,
        childInstrumentId,
        snapshotDate: input.snapshotDate,
        weight,
        source: input.source,
        raw: input.raw ?? null,
      })
      .onConflictDoUpdate({
        target: [
          compositionSnapshots.parentInstrumentId,
          compositionSnapshots.childInstrumentId,
          compositionSnapshots.snapshotDate,
          compositionSnapshots.source,
        ],
        set: {
          weight,
          raw: input.raw ?? null,
          updatedAt: now,
        },
      });
  }

  async upsertValuationSnapshot(
    input: UpsertValuationSnapshotInput,
  ): Promise<void> {
    const instrumentId = await this.getInstrumentId(
      input.symbol,
      "upsert valuation snapshot",
    );
    const source = mapValuationSource(input.source);
    const now = new Date();
    const emptyMetrics = {
      price: null,
      ntmEps: null,
      earningsYield: null,
      forwardPe: null,
      estimatePeriods: null,
      analystCount: null,
      fallbackReason: null,
      unavailableReason: null,
      coveredWeight: null,
      missingWeight: null,
      quarterlySumWeight: null,
      fiscalYearInterpolationWeight: null,
      unavailableWeight: null,
      constituentCount: null,
      coveredConstituentCount: null,
      quarterlySumCount: null,
      fiscalYearInterpolationCount: null,
      unavailableCount: null,
    } satisfies Partial<typeof valuationSnapshots.$inferInsert>;
    const metrics: Partial<typeof valuationSnapshots.$inferInsert> = {
      ...emptyMetrics,
    };

    if (input.valuation.method === "aggregate") {
      metrics.earningsYield = toNumeric(input.valuation.earningsYield);
      metrics.forwardPe = toNumeric(input.valuation.forwardPe);
      metrics.coveredWeight = toNumeric(input.valuation.coveredWeight);
      metrics.missingWeight = toNumeric(input.valuation.missingWeight);
      metrics.quarterlySumWeight = toNumeric(
        input.valuation.quarterlySumWeight,
      );
      metrics.fiscalYearInterpolationWeight = toNumeric(
        input.valuation.fiscalYearInterpolationWeight,
      );
      metrics.unavailableWeight = toNumeric(input.valuation.unavailableWeight);
      metrics.constituentCount = input.valuation.constituentCount;
      metrics.coveredConstituentCount =
        input.valuation.coveredConstituentCount;
      metrics.quarterlySumCount = input.valuation.quarterlySumCount;
      metrics.fiscalYearInterpolationCount =
        input.valuation.fiscalYearInterpolationCount;
      metrics.unavailableCount = input.valuation.unavailableCount;
    } else {
      metrics.price = toNumeric(input.valuation.price);
      metrics.ntmEps = toNumeric(input.valuation.ntmEps);
      metrics.earningsYield = toNumeric(input.valuation.earningsYield);
      metrics.forwardPe = toNumeric(input.valuation.forwardPe);
      metrics.estimatePeriods = input.valuation.estimatePeriods;
      metrics.analystCount = input.valuation.analystCount;
      metrics.fallbackReason = input.valuation.fallbackReason ?? null;
      metrics.unavailableReason = input.valuation.unavailableReason ?? null;
    }

    await this.db
      .insert(valuationSnapshots)
      .values({
        instrumentId,
        snapshotDate: input.snapshotDate,
        method: input.valuation.method,
        source,
        ...metrics,
      })
      .onConflictDoUpdate({
        target: [
          valuationSnapshots.instrumentId,
          valuationSnapshots.snapshotDate,
          valuationSnapshots.method,
          valuationSnapshots.source,
        ],
        set: {
          ...metrics,
          updatedAt: now,
        },
      });
  }

  async getLatestGroupConstituents(
    groupSlug: string,
  ): Promise<Array<{ symbol: string; weight: number }>> {
    const rows = await this.db
      .select({
        symbol: instruments.symbol,
        weight: groupMemberships.weight,
        effectiveDate: groupMemberships.effectiveDate,
      })
      .from(groupMemberships)
      .innerJoin(
        instrumentGroups,
        eq(groupMemberships.groupId, instrumentGroups.id),
      )
      .innerJoin(instruments, eq(groupMemberships.instrumentId, instruments.id))
      .where(eq(instrumentGroups.slug, groupSlug))
      .orderBy(desc(groupMemberships.effectiveDate));

    const latestDate = rows[0]?.effectiveDate;
    if (!latestDate) {
      return [];
    }

    return rows
      .filter((row) => row.effectiveDate === latestDate)
      .map((row) => {
        const storedWeight = fromNumeric(row.weight);

        return {
          symbol: row.symbol,
          weight: isPositiveFiniteNumber(storedWeight) ? storedWeight : 0,
        };
      });
  }

  async getLatestStockValuations(
    snapshotDate: string,
    symbols: string[],
  ): Promise<
    Array<{
      symbol: string;
      price: number | null;
      ntmEps: number | null;
      method: ValuationMethod;
    }>
  > {
    if (symbols.length === 0) {
      return [];
    }

    const rows = await this.db
      .select({
        symbol: instruments.symbol,
        price: valuationSnapshots.price,
        ntmEps: valuationSnapshots.ntmEps,
        method: valuationSnapshots.method,
      })
      .from(valuationSnapshots)
      .innerJoin(
        instruments,
        eq(valuationSnapshots.instrumentId, instruments.id),
      )
      .where(
        and(
          eq(valuationSnapshots.snapshotDate, snapshotDate),
          eq(valuationSnapshots.source, "fmp_consensus_ntm_private"),
          inArray(instruments.symbol, symbols),
        ),
      )
      .orderBy(
        desc(valuationSnapshots.updatedAt),
        desc(valuationSnapshots.createdAt),
      );

    const latestBySymbol = new Map<
      string,
      {
        symbol: string;
        price: number | null;
        ntmEps: number | null;
        method: ValuationMethod;
      }
    >();

    for (const row of rows) {
      if (
        !latestBySymbol.has(row.symbol) &&
        isStockValuationMethod(row.method)
      ) {
        latestBySymbol.set(row.symbol, {
          symbol: row.symbol,
          price: fromNumeric(row.price),
          ntmEps: fromNumeric(row.ntmEps),
          method: row.method,
        });
      }
    }

    return Array.from(latestBySymbol.values());
  }
}

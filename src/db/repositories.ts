import { eq } from "drizzle-orm";
import type { DbClient } from "./client";
import { groupMemberships, instrumentGroups, instruments } from "./schema";

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

export class ForwardPeRepository {
  constructor(private readonly db: DbClient) {}

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

    const weight = input.weight == null ? null : input.weight.toString();
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
}

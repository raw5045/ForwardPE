import { describe, expect, it } from "vitest";
import { ForwardPeRepository } from "./repositories";

type SqlOrdering = {
  queryChunks?: Array<{ name?: string }>;
};

function orderedColumnName(ordering: unknown) {
  return (ordering as SqlOrdering).queryChunks?.[1]?.name;
}

describe("ForwardPeRepository", () => {
  it("preserves existing instrument metadata when optional fields are omitted from an upsert update", async () => {
    const inserts: unknown[] = [];
    const conflicts: unknown[] = [];
    const db = {
      insert: () => ({
        values: (input: unknown) => {
          inserts.push(input);
          return {
            onConflictDoUpdate: (input: unknown) => {
              conflicts.push(input);
            },
          };
        },
      }),
    };
    const repository = new ForwardPeRepository(db as never);

    await repository.upsertInstrument({
      symbol: "XLK",
      name: "XLK",
      type: "etf",
    });

    expect(inserts).toEqual([
      {
        symbol: "XLK",
        name: "XLK",
        type: "etf",
        exchange: null,
        sector: null,
        active: true,
      },
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toEqual({
      target: expect.anything(),
      set: {
        name: "XLK",
        type: "etf",
        updatedAt: expect.any(Date),
      },
    });
  });

  it("clears stale valuation metrics and updates timestamps on valuation upsert conflicts", async () => {
    const inserts: unknown[] = [];
    const conflicts: unknown[] = [];
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: "instrument-1" }],
          }),
        }),
      }),
      insert: () => ({
        values: (input: unknown) => {
          inserts.push(input);
          return {
            onConflictDoUpdate: (input: unknown) => {
              conflicts.push(input);
            },
          };
        },
      }),
    };
    const repository = new ForwardPeRepository(db as never);

    await repository.upsertValuationSnapshot({
      symbol: "AAPL",
      snapshotDate: "2026-05-06",
      source: "fmp_consensus_ntm_private",
      valuation: {
        symbol: "AAPL",
        method: "quarterly_sum",
        price: 100,
        ntmEps: 5,
        earningsYield: 0.05,
        forwardPe: 20,
        estimatePeriods: ["2026Q2", "2026Q3", "2026Q4", "2027Q1"],
        analystCount: 12,
      },
    });

    expect(inserts).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toEqual({
      target: expect.anything(),
      set: expect.objectContaining({
        price: "100",
        ntmEps: "5",
        coveredWeight: null,
        missingWeight: null,
        constituentCount: null,
        updatedAt: expect.any(Date),
      }),
    });
  });

  it("does not invent equal weights for latest group constituents when stored weights are missing", async () => {
    const query = {
      from: () => query,
      innerJoin: () => query,
      where: () => query,
      orderBy: async () => [
        { symbol: "AAPL", weight: null, effectiveDate: "2026-05-06" },
        { symbol: "MSFT", weight: null, effectiveDate: "2026-05-06" },
        { symbol: "OLD", weight: "1", effectiveDate: "2026-05-05" },
      ],
    };
    const db = {
      select: () => query,
    };
    const repository = new ForwardPeRepository(db as never);

    await expect(repository.getLatestGroupConstituents("sp500")).resolves.toEqual([
      { symbol: "AAPL", weight: 0 },
      { symbol: "MSFT", weight: 0 },
    ]);
  });

  it("orders same-date stock valuations by updated timestamp before created timestamp", async () => {
    const orderings: unknown[] = [];
    const query = {
      from: () => query,
      innerJoin: () => query,
      where: () => query,
      orderBy: async (...args: unknown[]) => {
        orderings.push(...args);

        return [
          {
            symbol: "AAPL",
            price: "100",
            ntmEps: "5",
            method: "quarterly_sum",
          },
        ];
      },
    };
    const db = {
      select: () => query,
    };
    const repository = new ForwardPeRepository(db as never);

    await expect(
      repository.getLatestStockValuations("2026-05-06", ["AAPL"]),
    ).resolves.toEqual([
      {
        symbol: "AAPL",
        price: 100,
        ntmEps: 5,
        method: "quarterly_sum",
      },
    ]);
    expect(orderedColumnName(orderings[0])).toBe("updated_at");
    expect(orderedColumnName(orderings[1])).toBe("created_at");
  });
});

import { describe, expect, it } from "vitest";
import { seedUniverse } from "./seed-universe";

describe("seedUniverse", () => {
  it("upserts tracked groups, index instruments, and sector ETF memberships", async () => {
    const groups: unknown[] = [];
    const instruments: unknown[] = [];
    const memberships: unknown[] = [];
    const repository = {
      upsertGroup: async (input: unknown) => {
        groups.push(input);
      },
      upsertInstrument: async (input: unknown) => {
        instruments.push(input);
      },
      upsertGroupMembership: async (input: unknown) => {
        memberships.push(input);
      },
    };

    await seedUniverse(repository, "2026-05-06");

    expect(groups).toEqual([
      { slug: "sp500", name: "S&P 500", type: "index" },
      { slug: "nasdaq100", name: "Nasdaq-100", type: "index" },
      { slug: "sector-etfs", name: "Sector ETFs", type: "watchlist" },
    ]);
    expect(instruments).toEqual([
      { symbol: "SP500", name: "S&P 500", type: "index" },
      { symbol: "NDX", name: "Nasdaq-100", type: "index" },
      { symbol: "QQQ", name: "Invesco QQQ Trust", type: "etf" },
      { symbol: "XLK", name: "XLK", type: "etf" },
      { symbol: "XLF", name: "XLF", type: "etf" },
      { symbol: "XLV", name: "XLV", type: "etf" },
      { symbol: "XLY", name: "XLY", type: "etf" },
      { symbol: "XLC", name: "XLC", type: "etf" },
      { symbol: "XLI", name: "XLI", type: "etf" },
      { symbol: "XLP", name: "XLP", type: "etf" },
      { symbol: "XLE", name: "XLE", type: "etf" },
      { symbol: "XLU", name: "XLU", type: "etf" },
      { symbol: "XLB", name: "XLB", type: "etf" },
      { symbol: "XLRE", name: "XLRE", type: "etf" },
    ]);
    expect(memberships).toEqual([
      {
        groupSlug: "sector-etfs",
        symbol: "XLK",
        effectiveDate: "2026-05-06",
        source: "manual_seed",
        raw: { symbol: "XLK" },
      },
      {
        groupSlug: "sector-etfs",
        symbol: "XLF",
        effectiveDate: "2026-05-06",
        source: "manual_seed",
        raw: { symbol: "XLF" },
      },
      {
        groupSlug: "sector-etfs",
        symbol: "XLV",
        effectiveDate: "2026-05-06",
        source: "manual_seed",
        raw: { symbol: "XLV" },
      },
      {
        groupSlug: "sector-etfs",
        symbol: "XLY",
        effectiveDate: "2026-05-06",
        source: "manual_seed",
        raw: { symbol: "XLY" },
      },
      {
        groupSlug: "sector-etfs",
        symbol: "XLC",
        effectiveDate: "2026-05-06",
        source: "manual_seed",
        raw: { symbol: "XLC" },
      },
      {
        groupSlug: "sector-etfs",
        symbol: "XLI",
        effectiveDate: "2026-05-06",
        source: "manual_seed",
        raw: { symbol: "XLI" },
      },
      {
        groupSlug: "sector-etfs",
        symbol: "XLP",
        effectiveDate: "2026-05-06",
        source: "manual_seed",
        raw: { symbol: "XLP" },
      },
      {
        groupSlug: "sector-etfs",
        symbol: "XLE",
        effectiveDate: "2026-05-06",
        source: "manual_seed",
        raw: { symbol: "XLE" },
      },
      {
        groupSlug: "sector-etfs",
        symbol: "XLU",
        effectiveDate: "2026-05-06",
        source: "manual_seed",
        raw: { symbol: "XLU" },
      },
      {
        groupSlug: "sector-etfs",
        symbol: "XLB",
        effectiveDate: "2026-05-06",
        source: "manual_seed",
        raw: { symbol: "XLB" },
      },
      {
        groupSlug: "sector-etfs",
        symbol: "XLRE",
        effectiveDate: "2026-05-06",
        source: "manual_seed",
        raw: { symbol: "XLRE" },
      },
    ]);
  });
});

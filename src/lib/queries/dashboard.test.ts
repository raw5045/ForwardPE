import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createDb: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("../../db/client", () => ({
  createDb: mocks.createDb,
}));

import {
  getInstrumentDetail,
  getOverviewRows,
  getSp500Rows,
} from "./dashboard";

type SqlChunk = {
  queryChunks?: unknown[];
  value?: unknown;
};

function sqlText(chunk: unknown): string {
  if (typeof chunk !== "object" || chunk === null) {
    return "";
  }

  const sqlChunk = chunk as SqlChunk;
  if (Array.isArray(sqlChunk.queryChunks)) {
    return sqlChunk.queryChunks.map(sqlText).join("");
  }

  if (Array.isArray(sqlChunk.value)) {
    return sqlChunk.value
      .filter((value): value is string => typeof value === "string")
      .join("");
  }

  return "";
}

describe("dashboard queries", () => {
  beforeEach(() => {
    mocks.createDb.mockReturnValue({ execute: mocks.execute });
    mocks.execute.mockReset();
  });

  it("maps overview valuation numeric strings to numbers and nulls", async () => {
    mocks.execute.mockResolvedValueOnce([
      {
        symbol: "SP500",
        name: "S&P 500",
        type: "index",
        price: null,
        ntmEps: null,
        forwardPe: "21.5",
        method: "aggregate",
        coveredWeight: "0.92",
        quarterlySumWeight: "0.4",
        fiscalYearInterpolationWeight: "0.5",
        unavailableWeight: "0.1",
        snapshotDate: "2026-05-06",
      },
    ]);

    await expect(getOverviewRows()).resolves.toEqual([
      {
        symbol: "SP500",
        name: "S&P 500",
        type: "index",
        price: null,
        ntmEps: null,
        forwardPe: 21.5,
        method: "aggregate",
        coveredWeight: 0.92,
        quarterlySumWeight: 0.4,
        fiscalYearInterpolationWeight: 0.5,
        unavailableWeight: 0.1,
        snapshotDate: "2026-05-06",
      },
    ]);
    expect(mocks.createDb).toHaveBeenCalledTimes(1);
  });

  it("casts overview ordinals to integers in the VALUES list", async () => {
    mocks.execute.mockResolvedValueOnce([]);

    await getOverviewRows();

    const statementText = sqlText(mocks.execute.mock.calls[0]?.[0]);
    expect(statementText).toContain("cast(");
    expect(statementText).toContain("as integer");
  });

  it("filters dashboard latest valuations to the private FMP source", async () => {
    mocks.execute.mockResolvedValue([]);

    await getOverviewRows();
    await getInstrumentDetail("AAPL");
    await getSp500Rows();

    const statements = mocks.execute.mock.calls.map((call) => sqlText(call[0]));
    expect(statements).toHaveLength(4);
    for (const statementText of statements) {
      expect(statementText).toContain(
        "v.source = 'fmp_consensus_ntm_private'",
      );
    }
  });

  it("returns latest instrument row plus chronological history", async () => {
    mocks.execute
      .mockResolvedValueOnce([
        {
          symbol: "AAPL",
          name: "Apple Inc.",
          type: "stock",
          price: "100",
          ntmEps: "5",
          forwardPe: "20",
          method: "quarterly_sum",
          coveredWeight: null,
          quarterlySumWeight: null,
          fiscalYearInterpolationWeight: null,
          unavailableWeight: null,
          snapshotDate: "2026-05-06",
        },
      ])
      .mockResolvedValueOnce([
        {
          snapshotDate: "2026-05-05",
          forwardPe: "19",
          ntmEps: "4.8",
          price: "91.2",
        },
        {
          snapshotDate: "2026-05-06",
          forwardPe: "20",
          ntmEps: "5",
          price: "100",
        },
      ]);

    await expect(getInstrumentDetail("aapl")).resolves.toEqual({
      row: {
        symbol: "AAPL",
        name: "Apple Inc.",
        type: "stock",
        price: 100,
        ntmEps: 5,
        forwardPe: 20,
        method: "quarterly_sum",
        coveredWeight: null,
        quarterlySumWeight: null,
        fiscalYearInterpolationWeight: null,
        unavailableWeight: null,
        snapshotDate: "2026-05-06",
      },
      history: [
        {
          snapshotDate: "2026-05-05",
          forwardPe: 19,
          ntmEps: 4.8,
          price: 91.2,
        },
        {
          snapshotDate: "2026-05-06",
          forwardPe: 20,
          ntmEps: 5,
          price: 100,
        },
      ],
    });
  });

  it("maps latest SP500 member stock valuations", async () => {
    mocks.execute.mockResolvedValueOnce([
      {
        symbol: "MSFT",
        name: "Microsoft Corp.",
        type: "stock",
        price: "50",
        ntmEps: "5",
        forwardPe: "10",
        method: "fiscal_year_interpolation",
        coveredWeight: null,
        quarterlySumWeight: null,
        fiscalYearInterpolationWeight: null,
        unavailableWeight: null,
        snapshotDate: "2026-05-06",
      },
    ]);

    await expect(getSp500Rows()).resolves.toEqual([
      {
        symbol: "MSFT",
        name: "Microsoft Corp.",
        type: "stock",
        price: 50,
        ntmEps: 5,
        forwardPe: 10,
        method: "fiscal_year_interpolation",
        coveredWeight: null,
        quarterlySumWeight: null,
        fiscalYearInterpolationWeight: null,
        unavailableWeight: null,
        snapshotDate: "2026-05-06",
      },
    ]);
  });
});

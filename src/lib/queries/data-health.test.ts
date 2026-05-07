import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createDb: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("../../db/client", () => ({
  createDb: mocks.createDb,
}));

import { getLatestMethodMix, getRecentIngestionRuns } from "./data-health";

describe("data health queries", () => {
  beforeEach(() => {
    mocks.createDb.mockReturnValue({ execute: mocks.execute });
    mocks.execute.mockReset();
  });

  it("returns recent ingestion runs with timestamp strings", async () => {
    const startedAt = new Date("2026-05-06T12:00:00.000Z");
    mocks.execute.mockResolvedValueOnce({
      rows: [
        {
          id: "run-1",
          runDate: "2026-05-06",
          status: "succeeded",
          startedAt,
          finishedAt: null,
          error: null,
        },
      ],
    });

    await expect(getRecentIngestionRuns()).resolves.toEqual([
      {
        id: "run-1",
        runDate: "2026-05-06",
        status: "succeeded",
        startedAt: "2026-05-06T12:00:00.000Z",
        finishedAt: null,
        error: null,
      },
    ]);
  });

  it("maps latest aggregate method mix numeric strings", async () => {
    mocks.execute.mockResolvedValueOnce([
      {
        symbol: "SP500",
        snapshotDate: "2026-05-06",
        quarterlySumCount: 300,
        fiscalYearInterpolationCount: 150,
        unavailableCount: 50,
        quarterlySumWeight: "0.6",
        fiscalYearInterpolationWeight: "0.3",
        unavailableWeight: "0.1",
      },
    ]);

    await expect(getLatestMethodMix()).resolves.toEqual([
      {
        symbol: "SP500",
        snapshotDate: "2026-05-06",
        quarterlySumCount: 300,
        fiscalYearInterpolationCount: 150,
        unavailableCount: 50,
        quarterlySumWeight: 0.6,
        fiscalYearInterpolationWeight: 0.3,
        unavailableWeight: 0.1,
      },
    ]);
  });
});

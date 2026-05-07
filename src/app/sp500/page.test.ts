import { describe, expect, it } from "vitest";
import { getSnapshotDateLabel } from "./snapshot-label";

describe("getSnapshotDateLabel", () => {
  it("returns no snapshots when no rows have a snapshot date", () => {
    expect(
      getSnapshotDateLabel([
        { snapshotDate: null },
        { snapshotDate: null }
      ])
    ).toBe("No snapshots");
  });

  it("returns the shared date when every dated row has the same snapshot date", () => {
    expect(
      getSnapshotDateLabel([
        { snapshotDate: "2026-05-06" },
        { snapshotDate: "2026-05-06" }
      ])
    ).toBe("2026-05-06");
  });

  it("returns mixed snapshots when dated and undated rows are both present", () => {
    expect(
      getSnapshotDateLabel([
        { snapshotDate: "2026-05-06" },
        { snapshotDate: null }
      ])
    ).toBe("Mixed snapshots: through 2026-05-06");
  });

  it("returns a deterministic range when rows have mixed snapshot dates", () => {
    expect(
      getSnapshotDateLabel([
        { snapshotDate: "2026-05-05" },
        { snapshotDate: "2026-05-07" },
        { snapshotDate: "2026-05-06" }
      ])
    ).toBe("Mixed snapshots: 2026-05-05 to 2026-05-07");
  });
});

import { describe, expect, it } from "vitest";
import { ForwardPeRepository } from "./repositories";

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
});

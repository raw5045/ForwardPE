import type { DbClient } from "./client";

export type SnapshotDate = string;

export type UpsertInstrumentInput = {
  symbol: string;
  name: string;
  type: "stock" | "etf" | "index" | "synthetic";
  exchange?: string | null;
  sector?: string | null;
  active?: boolean;
};

export class ForwardPeRepository {
  constructor(private readonly db: DbClient) {
    void this.db;
  }

  async upsertInstrument(_input: UpsertInstrumentInput) {
    throw new Error("upsertInstrument is implemented in Task 7");
  }
}

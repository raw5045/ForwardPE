import type { ForwardPeRepository } from "../../db/repositories";
import { indexInstruments, sectorEtfs, trackedGroups } from "../universe/defaults";

type SeedUniverseRepository = Pick<
  ForwardPeRepository,
  "upsertGroup" | "upsertGroupMembership" | "upsertInstrument"
>;

export async function seedUniverse(repository: SeedUniverseRepository, effectiveDate: string) {
  for (const group of trackedGroups) {
    await repository.upsertGroup(group);
  }

  for (const instrument of indexInstruments) {
    await repository.upsertInstrument(instrument);
  }

  for (const symbol of sectorEtfs) {
    await repository.upsertInstrument({
      symbol,
      name: symbol,
      type: "etf",
    });
    await repository.upsertGroupMembership({
      groupSlug: "sector-etfs",
      symbol,
      effectiveDate,
      source: "manual_seed",
      raw: { symbol },
    });
  }
}

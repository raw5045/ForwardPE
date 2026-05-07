import { createDb } from "../src/db/client";
import { ForwardPeRepository } from "../src/db/repositories";
import { seedUniverse } from "../src/lib/ingestion/seed-universe";

async function main() {
  const effectiveDate = new Date().toISOString().slice(0, 10);
  const repository = new ForwardPeRepository(createDb());

  await seedUniverse(repository, effectiveDate);
  console.log(`Seeded tracked universe for ${effectiveDate}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

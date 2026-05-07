import { createDb } from "../src/db/client";
import { ForwardPeRepository } from "../src/db/repositories";
import { runDailyIngestion } from "../src/lib/ingestion/run-daily-ingestion";
import { FmpProvider } from "../src/lib/providers/fmp/provider";

async function main() {
  const runDate = process.argv[2] ?? new Date().toISOString().slice(0, 10);
  const result = await runDailyIngestion({
    repository: new ForwardPeRepository(createDb()),
    provider: new FmpProvider(),
    runDate,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

import { NextResponse } from "next/server";
import { createDb } from "@/db/client";
import { ForwardPeRepository } from "@/db/repositories";
import { runDailyIngestion } from "@/lib/ingestion/run-daily-ingestion";
import { FmpProvider } from "@/lib/providers/fmp/provider";
import { isAuthorizedRequest } from "@/middleware";

export async function POST(request: Request) {
  if (!isAuthorizedRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const runDate =
    typeof body.runDate === "string"
      ? body.runDate
      : new Date().toISOString().slice(0, 10);

  const result = await runDailyIngestion({
    repository: new ForwardPeRepository(createDb()),
    provider: new FmpProvider(),
    runDate
  });

  return NextResponse.json(result);
}

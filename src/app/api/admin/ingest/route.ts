import { NextResponse } from "next/server";
import { createDb } from "../../../../db/client";
import { ForwardPeRepository } from "../../../../db/repositories";
import { isAuthorizedRequest } from "../../../../lib/auth/internal";
import { runDailyIngestion } from "../../../../lib/ingestion/run-daily-ingestion";
import { FmpProvider } from "../../../../lib/providers/fmp/provider";

type ParsedIngestBody =
  | {
      ok: true;
      runDate: string;
    }
  | {
      ok: false;
      error: string;
    };

const runDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function isValidRunDate(runDate: string) {
  const [yearText, monthText, dayText] = runDate.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.toISOString().slice(0, 10) === runDate
  );
}

async function parseIngestBody(request: Request): Promise<ParsedIngestBody> {
  const rawBody = await request.text();

  if (rawBody.trim() === "") {
    return { ok: true, runDate: todayIsoDate() };
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return { ok: false, error: "Malformed JSON" };
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "JSON body must be an object" };
  }

  const runDate = (body as { runDate?: unknown }).runDate;

  if (runDate === undefined) {
    return { ok: true, runDate: todayIsoDate() };
  }

  if (typeof runDate !== "string" || !runDatePattern.test(runDate)) {
    return { ok: false, error: "runDate must use YYYY-MM-DD format" };
  }

  if (!isValidRunDate(runDate)) {
    return { ok: false, error: "runDate must be a valid YYYY-MM-DD date" };
  }

  return { ok: true, runDate };
}

export async function POST(request: Request) {
  if (!isAuthorizedRequest(request, undefined, { allowMissingToken: false })) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await parseIngestBody(request);
  if (!body.ok) {
    return NextResponse.json({ error: body.error }, { status: 400 });
  }

  const result = await runDailyIngestion({
    repository: new ForwardPeRepository(createDb()),
    provider: new FmpProvider(),
    runDate: body.runDate
  });

  return NextResponse.json(result, {
    status: result.status === "failed" ? 500 : 200
  });
}

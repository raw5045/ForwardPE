import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const runDailyIngestionMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../db/client", () => ({
  createDb: vi.fn(() => ({}))
}));

vi.mock("../../../../db/repositories", () => ({
  ForwardPeRepository: vi.fn(function ForwardPeRepository() {
    return {};
  })
}));

vi.mock("../../../../lib/ingestion/run-daily-ingestion", () => ({
  runDailyIngestion: runDailyIngestionMock
}));

vi.mock("../../../../lib/providers/fmp/provider", () => ({
  FmpProvider: vi.fn(function FmpProvider() {
    return {};
  })
}));

const url = "http://localhost:3000/api/admin/ingest";
const authorizedHeaders = { authorization: "Bearer secret" };

function createPostRequest(body?: string) {
  return new Request(url, {
    method: "POST",
    headers: authorizedHeaders,
    body
  });
}

describe("POST /api/admin/ingest", () => {
  beforeEach(() => {
    vi.stubEnv("INTERNAL_ACCESS_TOKEN", "secret");
    runDailyIngestionMock.mockResolvedValue({
      status: "succeeded",
      runId: "run-1",
      runDate: "2026-05-06",
      symbolsProcessed: 1,
      errors: []
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("rejects admin ingestion when INTERNAL_ACCESS_TOKEN is not configured", async () => {
    vi.stubEnv("INTERNAL_ACCESS_TOKEN", "");

    const response = await POST(new Request(url, { method: "POST" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(runDailyIngestionMock).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(createPostRequest("{"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Malformed JSON" });
    expect(runDailyIngestionMock).not.toHaveBeenCalled();
  });

  it("returns 400 for non-object JSON", async () => {
    const response = await POST(createPostRequest("null"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "JSON body must be an object" });
    expect(runDailyIngestionMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid runDate values", async () => {
    const response = await POST(createPostRequest(JSON.stringify({ runDate: "today" })));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "runDate must use YYYY-MM-DD format"
    });
    expect(runDailyIngestionMock).not.toHaveBeenCalled();
  });

  it("returns 400 for impossible runDate month values", async () => {
    const response = await POST(
      createPostRequest(JSON.stringify({ runDate: "2026-99-99" }))
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "runDate must be a valid YYYY-MM-DD date"
    });
    expect(runDailyIngestionMock).not.toHaveBeenCalled();
  });

  it("returns 400 for impossible runDate day values", async () => {
    const response = await POST(
      createPostRequest(JSON.stringify({ runDate: "2026-02-30" }))
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "runDate must be a valid YYYY-MM-DD date"
    });
    expect(runDailyIngestionMock).not.toHaveBeenCalled();
  });

  it("passes valid runDate values through to ingestion", async () => {
    const response = await POST(
      createPostRequest(JSON.stringify({ runDate: "2026-05-01" }))
    );

    expect(response.status).toBe(200);
    expect(runDailyIngestionMock).toHaveBeenCalledWith(
      expect.objectContaining({ runDate: "2026-05-01" })
    );
  });

  it("defaults an empty body to today", async () => {
    vi.setSystemTime(new Date("2026-05-06T12:00:00.000Z"));

    const response = await POST(createPostRequest());

    expect(response.status).toBe(200);
    expect(runDailyIngestionMock).toHaveBeenCalledWith(
      expect.objectContaining({ runDate: "2026-05-06" })
    );
  });

  it("returns 500 when ingestion fails", async () => {
    runDailyIngestionMock.mockResolvedValueOnce({
      status: "failed",
      runId: "run-1",
      runDate: "2026-05-06",
      symbolsProcessed: 0,
      errors: ["database unavailable"]
    });

    const response = await POST(createPostRequest());

    expect(response.status).toBe(500);
  });

  it("returns 200 when ingestion is partial", async () => {
    runDailyIngestionMock.mockResolvedValueOnce({
      status: "partial",
      runId: "run-1",
      runDate: "2026-05-06",
      symbolsProcessed: 1,
      errors: ["AAPL: unavailable"]
    });

    const response = await POST(createPostRequest());

    expect(response.status).toBe(200);
  });
});

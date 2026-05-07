import { afterEach, describe, expect, it, vi } from "vitest";
import { FmpClient } from "./client";

describe("FmpClient", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects missing and blank API keys", () => {
    vi.stubEnv("FMP_API_KEY", "");

    expect(() => new FmpClient()).toThrow("FMP_API_KEY is required");
    expect(() => new FmpClient("   ")).toThrow("FMP_API_KEY is required");
  });

  it("appends API key and defined params to the request URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ symbol: "AAPL", price: 225 }]), {
        status: 200
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new FmpClient("test-key");
    await client.get("/batch-quote-short", {
      symbols: "AAPL,MSFT",
      limit: 20,
      unused: undefined
    });

    const requestedUrl = fetchMock.mock.calls[0]?.[0] as URL;
    expect(requestedUrl.pathname).toBe("/stable/batch-quote-short");
    expect(requestedUrl.searchParams.get("apikey")).toBe("test-key");
    expect(requestedUrl.searchParams.get("symbols")).toBe("AAPL,MSFT");
    expect(requestedUrl.searchParams.get("limit")).toBe("20");
    expect(requestedUrl.searchParams.has("unused")).toBe(false);
  });

  it("includes a bounded response body snippet for non-OK responses", async () => {
    const longBody = `rate limited ${"x".repeat(300)}`;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(longBody, {
          status: 429
        })
      )
    );

    const client = new FmpClient("test-key");

    try {
      await client.get("/batch-quote-short");
      throw new Error("Expected FmpClient.get to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(
        /^FMP request failed 429: \/stable\/batch-quote-short: rate limited x+/
      );
      expect((error as Error).message.length).toBeLessThan(longBody.length);
    }
  });

  it("wraps invalid JSON responses with path and status context", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("not json", {
          status: 200
        })
      )
    );

    const client = new FmpClient("test-key");

    await expect(client.get("/analyst-estimates")).rejects.toThrow(
      "FMP response was not valid JSON for /stable/analyst-estimates (status 200)"
    );
  });
});

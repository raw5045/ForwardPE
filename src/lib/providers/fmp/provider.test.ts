import { describe, expect, it, vi } from "vitest";
import { FmpProvider } from "./provider";

type FmpProviderGet = (
  path: string,
  params?: Record<string, string | number | undefined>
) => Promise<unknown>;

const createProvider = (get: FmpProviderGet) => new FmpProvider({ get });

describe("FmpProvider", () => {
  it("does not call the client for empty quote requests", async () => {
    const get = vi.fn();
    const provider = createProvider(get);

    await expect(provider.getQuotes([])).resolves.toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });

  it("throws a contextual error when estimates return a non-array response", async () => {
    const get = vi.fn().mockResolvedValue({ error: "plan limit" });
    const provider = createProvider(get);

    await expect(provider.getEstimates("AAPL", "annual")).rejects.toThrow(
      "FMP analyst estimates for AAPL annual response was not an array"
    );
  });

  it("throws a contextual error when quotes return a non-array response", async () => {
    const get = vi.fn().mockResolvedValue(null);
    const provider = createProvider(get);

    await expect(provider.getQuotes(["AAPL"])).rejects.toThrow(
      "FMP quotes for AAPL response was not an array"
    );
  });

  it("throws a contextual error when S&P 500 constituents return a non-array response", async () => {
    const get = vi.fn().mockResolvedValue({ data: [] });
    const provider = createProvider(get);

    await expect(provider.getSp500Constituents()).rejects.toThrow(
      "FMP S&P 500 constituents response was not an array"
    );
  });

  it("throws a contextual error when ETF holdings return a non-array response", async () => {
    const get = vi.fn().mockResolvedValue({ holdings: [] });
    const provider = createProvider(get);

    await expect(provider.getEtfHoldings("SPY")).rejects.toThrow(
      "FMP ETF holdings for SPY response was not an array"
    );
  });

  it("maps quote responses and passes request params to the client", async () => {
    const get = vi.fn().mockResolvedValue([
      { symbol: "AAPL", price: 225.1 },
      { symbol: "MSFT", price: "410.5" }
    ]);
    const provider = createProvider(get);

    await expect(provider.getQuotes(["AAPL", "MSFT"])).resolves.toMatchObject([
      { symbol: "AAPL", price: 225.1 },
      { symbol: "MSFT", price: 410.5 }
    ]);
    expect(get).toHaveBeenCalledWith("/batch-quote-short", { symbols: "AAPL,MSFT" });
  });
});

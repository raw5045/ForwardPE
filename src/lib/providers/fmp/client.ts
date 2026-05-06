export class FmpClient {
  private readonly baseUrl = "https://financialmodelingprep.com/stable";
  private readonly apiKey: string;

  constructor(apiKey = process.env.FMP_API_KEY) {
    if (!apiKey) {
      throw new Error("FMP_API_KEY is required");
    }

    this.apiKey = apiKey;
  }

  async get<T>(
    path: string,
    params: Record<string, string | number | undefined> = {}
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set("apikey", this.apiKey);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`FMP request failed ${response.status}: ${url.pathname}`);
    }

    return response.json() as Promise<T>;
  }
}

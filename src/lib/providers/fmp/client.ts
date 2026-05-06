export class FmpClient {
  private readonly baseUrl = "https://financialmodelingprep.com/stable";
  private readonly apiKey: string;
  private readonly errorBodySnippetLength = 200;

  constructor(apiKey = process.env.FMP_API_KEY) {
    const trimmedApiKey = apiKey?.trim();

    if (!trimmedApiKey) {
      throw new Error("FMP_API_KEY is required");
    }

    this.apiKey = trimmedApiKey;
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
      const bodySnippet = await this.readErrorBodySnippet(response);
      const bodyContext = bodySnippet ? `: ${bodySnippet}` : "";

      throw new Error(`FMP request failed ${response.status}: ${url.pathname}${bodyContext}`);
    }

    try {
      return (await response.json()) as T;
    } catch (cause) {
      const error = new Error(
        `FMP response was not valid JSON for ${url.pathname} (status ${response.status})`
      );
      (error as Error & { cause?: unknown }).cause = cause;
      throw error;
    }
  }

  private async readErrorBodySnippet(response: Response): Promise<string> {
    try {
      return (await response.text()).trim().slice(0, this.errorBodySnippetLength);
    } catch {
      return "";
    }
  }
}

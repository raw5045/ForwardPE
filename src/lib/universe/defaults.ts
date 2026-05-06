export const sectorEtfs = [
  "XLK",
  "XLF",
  "XLV",
  "XLY",
  "XLC",
  "XLI",
  "XLP",
  "XLE",
  "XLU",
  "XLB",
  "XLRE",
] as const;

export const indexInstruments = [
  { symbol: "SP500", name: "S&P 500", type: "index" as const },
  { symbol: "NDX", name: "Nasdaq-100", type: "index" as const },
  { symbol: "QQQ", name: "Invesco QQQ Trust", type: "etf" as const },
];

export const trackedGroups = [
  { slug: "sp500", name: "S&P 500", type: "index" },
  { slug: "nasdaq100", name: "Nasdaq-100", type: "index" },
  { slug: "sector-etfs", name: "Sector ETFs", type: "watchlist" },
] as const;

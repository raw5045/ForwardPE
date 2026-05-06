# Forward P/E Dashboard Design

## Purpose

Build an internal-only dashboard that tracks next-twelve-month forward P/E ratios for major indexes, ETFs, sector ETFs, and S&P 500 stocks. The first version uses Financial Modeling Prep (FMP) data under a private/internal-use assumption. The application stores daily snapshots so history begins accumulating immediately and the system can later support a public-safe valuation model or a licensed public data provider.

The prototype is not a public website. No FMP-sourced or FMP-derived data should be exposed to public users unless a separate display or redistribution license is obtained.

## Initial Scope

The first version tracks:

- S&P 500 index
- Nasdaq Composite
- Nasdaq-100 / NDX
- QQQ
- Sector ETFs: XLK, XLF, XLV, XLY, XLC, XLI, XLP, XLE, XLU, XLB, XLRE
- All current S&P 500 constituents

The primary metric is next-twelve-month (NTM) forward P/E. Historical charts are based on stored snapshots collected by the app. Historical backfill from FMP can be used internally if the plan supports it, but public display of vendor-derived historical values remains out of scope unless licensing permits it.

## Hosting And Runtime

Neon Postgres is the required hosted dependency because the user already has a subscription and the app needs durable snapshot storage.

Vercel, Railway, or another application host is not required for the first internal prototype. The first version can run locally against Neon with manual ingestion and local scheduled ingestion. This keeps the cost and operational surface low while the data model and calculations are being validated.

A hosted runtime becomes useful when one or more of these are needed:

- Daily ingestion should run even when the local machine is offline.
- The dashboard should be reachable from multiple devices.
- Preview deployments and production deployments are useful.
- Background jobs need a persistent worker process.

If the app is deployed later, the preferred split is:

- Vercel for the Next.js dashboard and API routes.
- Vercel Cron for lightweight scheduled ingestion if execution time is acceptable.
- Railway, Fly, Render, or a similar worker host if ingestion becomes too long-running for serverless cron.
- Neon remains the database in both local and hosted modes.

## Architecture

Use a Next.js and TypeScript application with a small, explicit backend/data layer. The app should keep provider-specific code isolated so FMP can be replaced or supplemented later.

Main units:

- Web UI: dashboard pages, instrument pages, screener, and admin/data-health views.
- API layer: typed server endpoints for reading normalized dashboard data.
- Provider adapters: FMP-specific clients for prices, estimates, compositions, and metadata.
- Normalization layer: maps provider responses into internal database records.
- Calculation layer: computes NTM EPS, earnings yield, forward P/E, aggregate values, coverage, and percentile/range stats.
- Ingestion layer: runs daily and on demand, records failures, and stores snapshots.

Recommended stack:

- Next.js with App Router
- TypeScript
- Neon Postgres
- Drizzle ORM
- Server-side rendering for main dashboard pages
- Simple private auth gate for internal use

## Data Providers

FMP is the initial provider for:

- Prices
- Historical prices
- Analyst EPS estimates
- S&P 500 constituents
- ETF holdings or compositions where available
- Index metadata or index price series where available

Provider boundaries should be created from day one:

- `EstimateProvider`
- `PriceProvider`
- `CompositionProvider`
- `InstrumentMetadataProvider`

Prices are intentionally replaceable because the user may have other APIs with better reliability, cost, or coverage. Estimate data and composition data are treated as more sensitive because they drive the valuation methodology and licensing risk.

## Data Model

Core tables:

- `instruments`: one row per stock, ETF, index, or synthetic aggregate.
- `instrument_groups`: named universes such as S&P 500, Nasdaq-100, sector ETFs, and watchlists.
- `group_memberships`: point-in-time membership for stocks and groups.
- `price_snapshots`: daily price data by instrument.
- `estimate_snapshots`: EPS estimate data by stock and period.
- `composition_snapshots`: point-in-time weights and constituents for ETFs/indexes.
- `valuation_snapshots`: computed NTM EPS, earnings yield, forward P/E, coverage, and method flags.
- `ingestion_runs`: ingestion attempts, provider calls, timing, status, and errors.

Rows that can change over time should be snapshot-based instead of overwritten. This preserves historical calculations when constituents, estimates, or weights change.

## NTM Forward P/E Method

For individual stocks:

```text
forward_pe_ntm = price / ntm_eps
```

NTM EPS calculation priority:

1. Sum the next four quarterly EPS estimates when available.
2. Fall back to interpolation between current fiscal year and next fiscal year EPS estimates when quarterly data is incomplete.
3. Mark the valuation as unavailable when neither method has enough usable data.

Each computed value stores the method used, the source provider, and enough metadata to audit why a number exists or is missing.

For ETFs and indexes:

```text
constituent_ntm_earnings_yield = constituent_ntm_eps / constituent_price
aggregate_forward_pe = 1 / sum(weight * constituent_ntm_earnings_yield)
```

This avoids averaging P/E ratios, which can produce misleading aggregate results.

Aggregate records should also store:

- `covered_weight`: percentage of index/ETF weight with usable NTM EPS.
- `missing_weight`: percentage without usable NTM EPS.
- `constituent_count`
- `covered_constituent_count`
- `method`
- `source`

Nasdaq Composite may initially have limited or proxy coverage if reliable constituent weights are not available through FMP. The app should label this clearly in the admin/data-health UI and in the instrument detail page.

## User Interface

The UI should be simple, clean, and information-dense rather than marketing-oriented.

Primary screens:

- Overview dashboard: latest NTM forward P/E across major indexes, QQQ, sector ETFs, and broad market aggregates.
- Instrument detail page: current valuation, historical chart, percentile/range, coverage quality, and top constituents where relevant.
- Stock detail page: price, NTM EPS, forward P/E, estimate history, and valuation history.
- S&P 500 screener: table of constituents with price, NTM EPS, forward P/E, sector, and last update.
- Admin/data health page: ingestion runs, stale symbols, missing estimates, failed provider calls, coverage by group, and manual run controls.
- Methodology page: explains NTM calculation, aggregate calculation, coverage rules, and internal-only FMP source usage.

The first screen should be the actual dashboard, not a landing page.

## Ingestion Flow

Daily ingestion runs after market close, with a manual admin trigger for testing.

Flow:

1. Start an `ingestion_runs` record.
2. Refresh instrument metadata and universe membership when scheduled.
3. Fetch latest prices.
4. Fetch analyst EPS estimates.
5. Fetch ETF/index compositions.
6. Normalize and write raw snapshots.
7. Compute stock valuation snapshots.
8. Compute ETF/index valuation snapshots.
9. Record coverage, warnings, and failures.
10. Finish the `ingestion_runs` record.

Ingestion should be idempotent by date and instrument. Re-running a job for the same date should update or replace that day's snapshots in a controlled way without duplicating values.

## Error Handling And Data Quality

Data quality is a first-class feature because the product depends on estimates and constituent coverage.

The app should handle:

- Missing EPS estimates
- Negative or zero NTM EPS
- Missing prices
- Missing or stale constituents
- Constituents without matching instrument records
- API rate limits
- Partial ingestion failures
- FMP endpoint shape changes

The UI should distinguish between a true valuation value and an unavailable value. Aggregates with low covered weight should be visibly marked as lower confidence.

## Public Transition Plan

The first prototype uses FMP consensus estimate data privately. A public version requires either a public display license or a valuation method based only on data the app is allowed to display.

All valuation snapshots should include a method/source flag such as:

- `fmp_consensus_ntm_private`
- `public_model_ntm`
- `manual_override`
- `vendor_display_license`

This allows the app to support multiple valuation sources later without changing the dashboard model.

Likely public path:

1. Build and validate the private FMP-backed dashboard.
2. Store internal snapshots and evaluate calculation quality.
3. Add a public-safe model based on permissible inputs such as prices, SEC actuals, company guidance, and transparent assumptions.
4. Compare public-safe model output against private FMP consensus internally.
5. Publish only the public-safe model, or negotiate a display license if consensus values are required publicly.

## Security And Access

The prototype should be private by default.

Requirements:

- FMP API keys stay server-side only.
- Neon connection strings stay in environment variables.
- Dashboard access requires an internal auth gate before deployment.
- Admin ingestion controls require the same internal auth gate.
- No endpoint should expose raw FMP responses to clients.

## Testing And Verification

Core tests should cover:

- NTM EPS calculation from quarterly estimates.
- NTM EPS fallback from fiscal-year estimates.
- Stock forward P/E calculation.
- Aggregate earnings-yield weighted forward P/E calculation.
- Handling of missing, zero, or negative EPS.
- Covered-weight calculation.
- Idempotent ingestion for a repeated date.
- Provider adapter parsing for representative FMP responses.

Manual verification should include:

- Run ingestion for a small symbol set.
- Check database snapshots.
- Check dashboard values against direct FMP responses.
- Check aggregate calculations with hand-computed examples.
- Confirm private auth blocks unauthenticated dashboard access when deployed or exposed beyond local development.

## Non-Goals

The first version will not:

- Display FMP-derived data publicly.
- Provide a public API.
- Build billing, subscriptions, or user accounts beyond private access.
- Guarantee full Nasdaq Composite valuation coverage if reliable weights are unavailable.
- Reconstruct historical point-in-time forward P/E without licensed historical estimate data.
- Build a SEC/company-guidance-derived public model in the first implementation pass.


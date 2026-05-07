# Forward P/E

Internal dashboard for tracking NTM forward P/E across the S&P 500, Nasdaq-100 / NDX, QQQ, sector ETFs, and S&P 500 constituents.

## Status

This app is an internal prototype. FMP-sourced and FMP-derived values must not be displayed publicly without a separate display or redistribution license.

## Stack

- Next.js
- TypeScript
- Neon Postgres
- Drizzle ORM
- FMP API
- Vitest

## Environment

Create `.env.local`:

```text
DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/forward_pe?sslmode=require"
FMP_API_KEY="your-fmp-key"
INTERNAL_ACCESS_TOKEN="local-secret"
```

## Local Setup

```powershell
npm install
npm run db:generate
npm run db:migrate
npm run seed
npm run dev
```

## Manual Ingestion

```powershell
npm run ingest
```

To ingest for a specific date:

```powershell
npm run ingest -- 2026-05-06
```

## Verification

```powershell
npm test
npm run typecheck
npm run build
```

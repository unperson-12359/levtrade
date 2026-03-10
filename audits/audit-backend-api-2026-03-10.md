# Backend / API Audit - 2026-03-10

## Current truth
- The active API surface is:
  - `api/observatory-snapshot.ts`
  - `api/observatory-analytics.ts`
  - `api/persist-observatory-states.ts`
  - `api/backfill-observatory-states.ts`
- Snapshot is read-only and price/candle-derived.
- Persistence and backfill are secret-gated and write to `observatory_indicator_states`.

## Findings
### High - Mutating routes still use `GET` and allow secrets in the query string
- `api/persist-observatory-states.ts:20-27` accepts only `GET` and passes `req.query.secret` into authorization.
- `api/backfill-observatory-states.ts:19-26` does the same.
- `api/_observatoryPersistence.ts:98-115` treats bearer token, custom header secret, and query-string secret as equivalent.
- Impact:
  - write operations can be triggered via cache-unfriendly `GET`
  - query-string secrets can leak into logs, browser history, and tooling
- Recommended fix:
  - make persistence and backfill `POST` only
  - remove query-string secret support
  - keep bearer or explicit header auth only

### Medium - Invalid request params silently coerce to defaults instead of failing
- `api/_hyperliquid.ts:23-35` defaults unknown coins to `BTC` and unknown intervals to `4h`.
- `api/observatory-snapshot.ts`, `api/observatory-analytics.ts`, and the persistence routes all inherit this behavior.
- Impact:
  - caller mistakes are hidden instead of rejected
  - privileged backfill requests can write an unintended market if params are malformed
- Recommended fix:
  - add strict validators for public route inputs and return `400` on invalid coin/interval.

### Medium - `observatory-analytics` has no explicit Vercel duration override
- `vercel.json` only sets `maxDuration` for:
  - `api/observatory-snapshot.ts`
  - `api/persist-observatory-states.ts`
  - `api/backfill-observatory-states.ts`
- `api/_observatoryAnalytics.ts:52-93` may paginate through many 1,000-row pages sequentially.
- Impact:
  - analytics can be the slowest route while having no explicit runtime budget in config
- Recommended fix:
  - add a function entry for `api/observatory-analytics.ts` in `vercel.json`
  - consider bounding default lookback or optimizing reads if latency grows.

### Medium - Ledger reads are page-by-page and fully sequential
- `api/_observatoryAnalytics.ts:7` uses `READ_BATCH_SIZE = 1_000`.
- `api/_observatoryAnalytics.ts:62-93` loops page by page with `limit` and `offset`.
- Impact:
  - large lookbacks create many sequential Supabase round trips
  - the route will get slower as the ledger grows
- Recommended fix:
  - keep the current logic for correctness, but plan either server-side aggregation, larger page sizing, or batched parallel reads.

### Low - Snapshot route is appropriately separated from persistence
- `api/observatory-snapshot.ts` remains read-only and does not touch `observatory_indicator_states`.
- This separation is a good current boundary and should be preserved.

## Live vs stale
### Live
- all four active observatory API routes
- `api/_hyperliquid.ts`
- `api/_contracts.ts`

### Stale or likely stale
- none inside the active API folder beyond the issues above
- broader stale operational artifacts live outside `api/` and are covered in repo-hygiene audits

## Risks if left as-is
- secret leakage risk remains on operational write routes
- silent parameter coercion hides bad clients and operator mistakes
- analytics latency becomes an operational problem before the config acknowledges it

## Recommended removals and fixes
- convert write routes to authenticated `POST`
- reject invalid coin and interval values with `400`
- add explicit `maxDuration` for `api/observatory-analytics.ts`
- keep snapshot read-only

## Proof checks needed after fixes
- `npm.cmd run build`
- `node tests/run-logic-tests.mjs`
- route-level checks:
  - `GET` on write routes fails with `405`
  - invalid coin/interval returns `400`
  - authenticated `POST` persistence/backfill still succeeds

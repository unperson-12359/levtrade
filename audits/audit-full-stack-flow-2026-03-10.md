# Full-Stack Flow Audit - 2026-03-10

## Current truth
- End-to-end flow:
  - browser websocket mids via `src/services/websocket.ts`
  - browser candle polling via `src/services/dataManager.ts`
  - server snapshot hydration via `api/observatory-snapshot.ts`
  - server persistence via `api/persist-observatory-states.ts` / `api/backfill-observatory-states.ts`
  - Supabase ledger reads via `api/observatory-analytics.ts`
- The live shell is snapshot/local-window driven.
- The Analytics page is ledger-backed with live-window fallback.

## Findings
### Medium - Browser and server duplicate Hyperliquid transport logic
- `src/services/api.ts:3-34` and `api/_hyperliquid.ts:5-54` both implement the same POST client for Hyperliquid.
- Both files own their own timeout and request-shape logic.
- Impact:
  - transport fixes need to be made twice
  - failure semantics can drift between browser and server
- Recommended fix:
  - consolidate shared request construction and validation rules, or document intentional divergence explicitly.

### Medium - Browser and server duplicate price-context derivation
- Local price context is built in `src/hooks/useIndicatorObservatory.ts:127-149`.
- Server price context is built in `api/observatory-snapshot.ts:95-118`.
- Impact:
  - the same market-facing summary values can drift if one side changes and the other does not
- Recommended fix:
  - move `buildPriceContext` into a shared module used by both browser and server.

### Medium - The current live path refetches large windows repeatedly
- Browser polling:
  - `src/services/dataManager.ts:85-99` refetches the full lookback window for each coin on every cycle
  - `src/services/dataManager.ts:148-156` does this for all tracked coins every minute
- Server snapshot:
  - `api/observatory-snapshot.ts:17` uses a fixed `180`-day lookback
  - `api/observatory-snapshot.ts:38-42` refetches candles and mids on cache miss
- Impact:
  - redundant transport load
  - avoidable latency and rate pressure as traffic grows
- Recommended fix:
  - move browser polling toward incremental candle refresh
  - bound or cache server snapshot windows more deliberately

### Medium - End-to-end context is still split between URL and persisted store state
- `src/hooks/useHashRouter.ts` preserves explicit market context for report URLs but not for analytics or methodology URLs.
- Impact:
  - full-stack behavior depends partly on URL and partly on last persisted local state
- Recommended fix:
  - make route state fully explicit for all top-level pages.

### Low - The live shell / ledger split is intentional and currently coherent
- Snapshot drives the observatory shell.
- Ledger drives persistence analytics.
- That split is visible in code and mostly truthfully represented in the UI.

## Live vs stale
### Live
- browser websocket/polling path
- server snapshot path
- Supabase ledger path

### Stale or likely stale
- retired collector path is not part of this flow anymore, but old artifacts still exist elsewhere in the workspace

## Risks if left as-is
- browser and server behavior drift independently
- transport work stays more expensive than needed
- route-sharing remains inconsistent

## Recommended removals and fixes
- consolidate shared market-summary logic
- reduce repeated full-window fetches
- make top-level route state explicit

## Proof checks needed after fixes
- `npm.cmd run build`
- `node tests/run-logic-tests.mjs`
- manual checks:
  - coin/timeframe switch
  - analytics deep-link sharing
  - live shell continuity during snapshot miss

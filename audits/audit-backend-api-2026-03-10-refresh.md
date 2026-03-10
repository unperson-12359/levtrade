# Backend / API Audit (Refresh)

## Current truth
- The active API surface is `observatory-snapshot`, `observatory-analytics`, `persist-observatory-states`, and `backfill-observatory-states`.
- Request validation and secret gating are materially better than the earlier canonical/setup architecture.

## Findings
1. Acceptable current behavior: the public read routes reject invalid `coin` and `interval` and the write routes no longer accept query-string secrets.
2. Confirmed improvement opportunity: the browser and server still duplicate Hyperliquid request/client logic in `src/services/api.ts` and `api/_hyperliquid.ts`. The duplication is small, but it creates drift risk for timeouts, parsing, and error semantics.
3. Confirmed truthfulness gap: `api/observatory-snapshot.ts` sets `livePriceObservedAtMs` to `generatedAt` at lines 64-72 whenever a mid price exists, so the server-reported `observedAt` is request-time, not exchange observation-time.

## Recommended fixes
- Consolidate Hyperliquid fetch logic into one shared implementation or a tightly mirrored helper with a single timeout/error contract.
- Rename or narrow the server-side `observedAt` semantics if true market observation time is unavailable from the upstream response.

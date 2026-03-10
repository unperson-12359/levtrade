# Production Parity Checklist

This checklist is the release contract for the live observatory product.

## Product truth
- The active product is the observatory shell mounted from `src/App.tsx`.
- Production parity means the live observatory behaves the same in browser, Vercel, and the generated API bundle.
- Legacy setup/tracker/collector infrastructure is not part of the observatory release gate.

## Required release surfaces
- `src/components/observatory/*`
- `src/hooks/useDataManager.ts`
- `src/hooks/useIndicatorObservatory.ts`
- `src/services/dataManager.ts`
- `api/observatory-snapshot.ts`
- `api/observatory-analytics.ts`
- `api/persist-observatory-states.ts`
- `api/backfill-observatory-states.ts`
- `src/observatory/engine.ts`
- `src/observatory/analytics.ts`
- `src/observatory/persistence.ts`
- `api/_signals.mjs`

## Required runtime inputs
- Hyperliquid websocket mids
- Hyperliquid candle snapshots
- Browser candle store
- Server observatory snapshot hydration

## Required persistence env vars
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OBSERVATORY_PERSIST_SECRET` or `CRON_SECRET`

## Active persistence infrastructure
- `observatory_indicator_states`
  - server-written boolean ledger for closed-bar indicator states
  - each row should carry the active observatory `rule_version`
  - powered by `api/persist-observatory-states.ts` for daily writes
  - backfilled by `api/backfill-observatory-states.ts`
  - not required for the current live shell to render

## Release build steps

```powershell
npm.cmd run build
npm.cmd run test:logic
npm.cmd run test:e2e:critical
npm.cmd run smoke:release -- --base-url https://levtrade.vercel.app --coin BTC --interval 4h --days 180
```

## Browser verification
- the observatory shell loads on the default route
- websocket connection status updates without hiding the shell
- coin and interval changes refresh the live chart and heatmap
- heatmap cell selection opens the candle report and browser back returns to the heatmap
- analytics and methodology routes still load from the observatory nav
- runtime diagnostics remain secondary and do not replace the market-reading surface

## API verification
- `/api/observatory-snapshot?coin=BTC&interval=4h` returns `200`
- `/api/observatory-analytics?coin=BTC&interval=4h&days=180` returns `200`
- the payload returns `ok: true`
- the snapshot includes the observatory model needed by the shell
- the analytics payload returns ledger-backed rows and category totals
- analytics, methodology, and observatory hashes preserve `coin` and `interval`
- the generated bundle `api/_signals.mjs` matches the current observatory source tree
- the persistence writer remains secret-gated and does not run through the public observatory route
- `vercel.json` includes the daily cron for `/api/persist-observatory-states`
- `GET /api/persist-observatory-states` is only accepted for trusted Vercel cron traffic; manual writes use authenticated `POST`

## Ledger freshness verification
- `observatory_indicator_states` has rows for:
  - `BTC 4h`, `BTC 1d`
  - `ETH 4h`, `ETH 1d`
  - `SOL 4h`, `SOL 1d`
  - `HYPE 4h`, `HYPE 1d`
- the latest persisted bar time is within the expected window for the interval under test

## Known deferred work
- the live shell still reads the snapshot window; only the Analytics page is ledger-backed
- operator runbooks for invoking `api/backfill-observatory-states` still need to be documented outside the release checklist

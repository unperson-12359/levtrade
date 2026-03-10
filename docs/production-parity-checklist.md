# Production Parity Checklist

This checklist is the release contract for the live observatory product.

## Product truth
- The active product is the observatory shell mounted from `src/App.tsx`.
- Production parity means the live observatory behaves the same in browser, Vercel, and the generated API bundle.
- Legacy setup/tracker/collector infrastructure is not part of the observatory release gate unless the current mounted app depends on it.

## Required release surfaces
- `src/components/observatory/*`
- `src/hooks/useDataManager.ts`
- `src/hooks/useIndicatorObservatory.ts`
- `src/services/dataManager.ts`
- `api/observatory-snapshot.ts`
- `src/observatory/engine.ts`
- `api/_signals.mjs`

## Required runtime inputs
- Hyperliquid websocket mids
- Hyperliquid candle snapshots
- Browser candle store
- Server observatory snapshot hydration

## Optional or deferred infrastructure
- `observatory_indicator_states`
  - planned persistence layer for per-bar indicator booleans
  - not required for the current live shell to render
- legacy setup/tracker/collector tables and APIs
  - not required for the observatory release gate
  - review separately before any deletion or migration

## Release build steps

```powershell
npm.cmd run build
npm.cmd run test:logic
npm.cmd run test:e2e:critical
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
- the payload returns `ok: true`
- the snapshot includes the observatory model needed by the shell
- the generated bundle `api/_signals.mjs` matches the current observatory source tree

## Known deferred work
- bar-close writes into `observatory_indicator_states` are not implemented yet
- the legacy setup/tracker/collector stack still exists in the repo and should not be treated as the live observatory contract

# Production Parity Checklist

This checklist is the release contract for keeping LevTrade's canonical analytics consistent across the browser, Vercel, Supabase, and the Oracle collector.

## Canonical ownership model
- Setup history is canonical when `server_setups` is available.
- Signal accuracy is canonical when `tracked_signals` is available and the collector is resolving outcomes.
- Browser-local tracker/setup state is fallback only when canonical endpoints are unavailable or empty.

## Required Supabase tables
- `server_setups`
- `tracked_signals`
- `collector_heartbeat`
- `oi_snapshots`

Required `server_setups` fields:
- `id`
- `scope`
- `coin`
- `direction`
- `setup_json`
- `outcomes_json`
- `generated_at`
- `updated_at`

Required `tracked_signals` fields:
- `id`
- `scope`
- `coin`
- `kind`
- `direction`
- `signal_json`
- `outcomes_json`
- `recorded_at`
- `updated_at`

## Required Vercel env vars
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `SETUP_UPLOAD_SECRET`

## Required browser env vars
- `VITE_SETUP_UPLOAD_SECRET`

This must match `SETUP_UPLOAD_SECRET` exactly for browser-to-server setup sync to work.

## Required Oracle collector env vars
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `COINALYZE_API_KEY` optional

## Deploy-sensitive build artifacts
These bundled files must reflect the current source tree before release:
- `api/_signals.mjs`
- `api/_collector.mjs`

## Release build steps
Run from the repo root:

```powershell
npm.cmd run test:logic
npm.cmd run build
npm.cmd run build:collector
```

## Browser verification
After deploy:
- open the observatory shell and confirm the default timeline view loads with the price chart and indicator heatmap
- confirm heatmap cell selection opens the candle report route and browser back returns to the heatmap
- confirm network view still renders indicator drilldown correctly after the cleanup pass
- confirm health/runtime/freshness states remain visible and fallback copy appears only when canonical endpoints are unavailable or empty

## Vercel verification
- `/api/server-setups` returns canonical setup rows
- `/api/signal-accuracy` returns canonical stats or a clear unavailable state
- `/api/collector-heartbeat` reports a live or stale heartbeat instead of failing
- `/api/upload-setups` rejects requests without the shared secret

## Oracle collector verification
- the service is running continuously
- heartbeat is updating
- new setups are written to `server_setups`
- setup outcomes are being resolved and patching `updated_at`
- tracked signals are being written and resolved

## Known parity dependencies
- If `tracked_signals.sql` is not applied, canonical signal accuracy will remain incomplete
- If the Oracle collector is down, canonical analytics will freeze
- If Vercel and Oracle are on different revisions, frontend expectations can drift from collector writes

# Agent C — Server Analytics Production Parity Trace

## Goal
Define exactly what must be true across Supabase, Vercel, Oracle, and the browser for cross-device canonical parity.

## Files inspected
- `src/services/api.ts`
- `src/services/dataManager.ts`
- `api/server-setups.ts`
- `api/signal-accuracy.ts`
- `api/upload-setups.ts`
- `api/collector-heartbeat.ts`
- `src/server/collector/runCollector.ts`
- `scripts/run-collector.ts`
- `scripts/collector-loop.ts`
- `supabase/server_setups.sql`
- `supabase/tracked_signals.sql`
- `supabase/collector_heartbeat.sql`
- `supabase/oi_snapshots.sql`
- `deploy/oracle/README.md`
- `.env.example`
- `.env.collector.example`

## Canonical setup history path
1. Setup is generated either:
   - in the Oracle collector (`source: server`), or
   - in the browser and uploaded if `syncEligible === true`
2. Canonical rows are stored in Supabase `server_setups`
3. Vercel exposes them via `/api/server-setups`
4. Browser hydrates `serverTrackedSetups`
5. Setup History uses server data whenever any canonical rows exist

## Canonical signal accuracy path
1. Oracle collector records tracked signals in Supabase `tracked_signals`
2. Collector resolves future outcomes over `4h`, `24h`, `72h`
3. Vercel aggregates via `/api/signal-accuracy`
4. Browser uses canonical stats when available
5. Browser falls back to local tracker stats only when canonical accuracy is unavailable or empty

## What must be true in Supabase
- `server_setups` table exists with:
  - `id`
  - `scope`
  - `coin`
  - `direction`
  - `setup_json`
  - `outcomes_json`
  - `generated_at`
  - `updated_at`
- `tracked_signals` table exists with:
  - `id`
  - `scope`
  - `coin`
  - `kind`
  - `direction`
  - `signal_json`
  - `outcomes_json`
  - `recorded_at`
  - `updated_at`
- `collector_heartbeat` table exists
- `oi_snapshots` table exists

## What must be true in Vercel
- Env vars:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CRON_SECRET`
  - `SETUP_UPLOAD_SECRET`
- `api/_signals.mjs` and `api/_collector.mjs` must match current source bundle outputs
- `/api/server-setups`, `/api/signal-accuracy`, `/api/upload-setups`, and `/api/collector-heartbeat` must deploy from the same repo revision as the frontend

## What must be true in the browser
- `VITE_SETUP_UPLOAD_SECRET` must match server `SETUP_UPLOAD_SECRET`
- Browser must be able to hydrate canonical setup history
- Browser now refreshes canonical setup history incrementally every `5 minutes`
- Local fallback state should only influence analytics when canonical endpoints are unavailable or empty

## What must be true on Oracle
- Collector service must be running continuously
- Required env:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `COINALYZE_API_KEY` optional
- Collector build must be current
- Collector must successfully write:
  - new server setups
  - resolved setup outcomes
  - tracked signals
  - resolved signal outcomes
  - heartbeat rows

## Findings
1. Setup-history parity was previously weak while the browser stayed open because canonical rows were not refreshed after init.
2. Setup outcome resolution in the collector was truncated by a `100` row cap per coin.
3. `.env.example` had stale naming and did not match the live upload secret contract.

## Implemented parity improvements
- Added browser-side incremental canonical setup refresh
- Added `updatedSince` support to `/api/server-setups`
- Expanded collector setup resolution pagination
- Updated `.env.example` to use:
  - `SETUP_UPLOAD_SECRET`
  - `VITE_SETUP_UPLOAD_SECRET`

## Remaining parity risks
- If `tracked_signals.sql` is not applied, canonical signal accuracy cannot be complete
- If the Oracle collector is down, canonical analytics will drift or freeze
- If Vercel and Oracle deploy different revisions, frontend expectations can diverge from collector writes

## Risk level
- Medium overall because parity depends on three runtimes staying aligned

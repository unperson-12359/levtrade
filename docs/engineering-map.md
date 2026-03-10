# Engineering Map

This map reflects the current mounted product: the live observatory shell.

## Active product runtime

### `src/App.tsx`
- The app mounts `ObservatoryLayout` only.
- Treat this as the product boundary when deciding what is live versus legacy.

### `src/components/observatory/*`
- Primary user-facing product surface.
- Includes the live shell, heatmap, candle report, analytics page, and methodology page.

### `src/hooks/useDataManager.ts`
- Starts the live runtime for the observatory shell.
- Edit here when the app should refetch candles differently on interval changes.

### `src/services/dataManager.ts`
- Minimal live runtime coordinator.
- Owns websocket mids, candle polling, connection status, and runtime diagnostics for the observatory.
- This should stay free of setup-history sync, collector heartbeat refresh, or canonical fallback orchestration.
- Browser polling now does bounded recent-window candle refreshes after the initial full hydration instead of reloading the full lookback on every minute tick.

### `src/hooks/useIndicatorObservatory.ts`
- Browser-facing observatory model builder.
- Combines local live candles and the server snapshot into the single shell model used by the observatory UI.

### `api/observatory-snapshot.ts`
- Server hydration endpoint for the observatory.
- Current contract is price/candle-derived observatory state, not canonical setup analytics.
- Shares `buildPriceContext(...)` with the browser so the shell uses the same price-summary semantics in both runtimes.

### `src/observatory/engine.ts`
- Core indicator engine for the observatory.
- Source of truth for price-derived indicator categories, bar states, heatmap/report clusters, and boolean state records.

### `supabase/observatory_indicator_states.sql`
- Minimal persistence schema for per-bar indicator on/off writes.
- This is now the observatory-specific historical ledger.
- The ledger now records `rule_version` so future indicator-rules changes can be traced to the rows they produced.

### `api/persist-observatory-states.ts`
- Secret-gated cron writer for `observatory_indicator_states`.
- Recomputes recent closed bars from the same observatory engine used by the UI, then upserts the boolean ledger.
- `GET` is reserved for trusted Vercel cron requests because Vercel cron jobs dispatch `GET`; manual invocations should use authenticated `POST`.

### `api/backfill-observatory-states.ts`
- Secret-gated manual backfill route for one `coin + interval` window at a time.
- Reuses the same persistence path as the cron writer so historical replay and ongoing writes stay consistent.

### `api/observatory-analytics.ts`
- Read-only analytics route backed by `observatory_indicator_states`.
- Aggregates historical active bars, streaks, last-hit times, and category totals for the Analytics page.

### `src/observatory/analytics.ts`
- Shared analytics builder for the persisted ledger and the live snapshot fallback window.
- Keeps the Analytics page contract stable while the live shell remains snapshot-driven.

## Removed legacy architecture

The old setup/tracker/collector product surfaces and APIs were removed from the mounted app and the repo:

- setup/tracker store slices
- setup/risk chart overlays and signal hooks
- collector and canonical setup APIs
- unmounted setup/risk/tracker/decision workflow components
- collector scripts and Supabase schema for the retired setup-history architecture
- Oracle collector deployment artifacts
- retired shared UI helpers like tooltip/jargon/collapsible shells

## Cleanup guidance

- Keep release decisions aligned to the mounted observatory shell, not to the older setup-first architecture.
- Treat `observatory_indicator_states` as the observatory history ledger instead of reintroducing setup-history infrastructure.
- If a future internal tool needs setup/backtest workflows again, add it behind a separate boundary instead of mixing it back into the observatory runtime.

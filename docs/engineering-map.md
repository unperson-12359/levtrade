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

### `src/hooks/useIndicatorObservatory.ts`
- Browser-facing observatory model builder.
- Combines local live candles and the server snapshot into the single shell model used by the observatory UI.

### `api/observatory-snapshot.ts`
- Server hydration endpoint for the observatory.
- Current contract is price/candle-derived observatory state, not canonical setup analytics.

### `src/observatory/engine.ts`
- Core indicator engine for the observatory.
- Source of truth for price-derived indicator categories, bar states, heatmap/report clusters, and boolean state records.

### `supabase/observatory_indicator_states.sql`
- Minimal persistence schema for future per-bar indicator on/off writes.
- This is the observatory-specific storage path going forward.

## Legacy architecture still present

These areas are not part of the mounted observatory product, but still exist in the repo:

### `src/store/setupSlice.ts`
- Legacy setup-history state and settlement path.

### `src/store/trackerSlice.ts`
- Legacy tracked-signal history and outcome path.

### `api/server-setups.ts`
- Canonical setup-history API.

### `api/signal-accuracy.ts`
- Canonical tracked-signal accuracy API.

### `api/collector-heartbeat.ts`
- Collector liveness API.

### `src/server/collector/runCollector.ts`
- Legacy collector runtime for setup/tracker/canonical analytics.

### `supabase/server_setups.sql`
### `supabase/tracked_signals.sql`
### `supabase/collector_heartbeat.sql`
- Legacy schema for the older canonical setup/tracker architecture.

## Cleanup guidance

- Do not treat legacy setup/tracker/collector code as part of the active observatory product unless a live import path proves otherwise.
- Prefer isolating or removing legacy runtime dependencies from the observatory before deleting deeper legacy code.
- Keep release decisions aligned to the mounted observatory shell, not to the older setup-first architecture.

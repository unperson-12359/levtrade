# Engineering Map

This is the focused handoff map for the LevTrade areas most likely to change next.

## Browser orchestration

### `src/services/dataManager.ts`
- Coordinates polling, WebSocket updates, canonical setup hydration, local fallback updates, and resolution passes.
- Edit here when setup freshness, polling cadence, or cross-runtime hydration behavior is wrong.
- Risk: high. Changes here affect multiple subsystems at once.

### `src/services/api.ts`
- Browser-side API client for Hyperliquid and Vercel endpoints.
- Edit here when frontend/server contracts change.

## Setup history truth path

### `src/store/setupSlice.ts`
- Stores canonical and local setup history, resolves local outcomes, merges canonical rows, and handles import/export.
- Edit here when rows duplicate, merge incorrectly, or local/browser settlement differs from canonical settlement.

### `src/signals/resolveOutcome.ts`
- Source of truth for setup settlement rules across `4h`, `24h`, and `72h`.
- Edit here when deadline, grace, coverage, or candle traversal logic is wrong.
- Risk: high. Used by browser, collector, and repair tooling.

### `src/components/setup/SetupHistory.tsx`
- Renders tracked setup rows and pending/resolved states.
- Edit here when the UI is showing misleading settlement labels or review actions.

### `src/components/shared/SignalDrawer.tsx`
- Shows setup autopsies and per-window outcomes.
- Edit here when review detail or outcome explanation is wrong.

## Step 1 -> Step 3 workflow

### `src/utils/workflowGuidance.ts`
- Central workflow copy and per-step status mapping.
- Edit here when workflow language drifts from product behavior.

### `src/signals/suggestedPosition.ts`
- Shared pure Step 3 composition engine used by the UI and tracker alignment.
- Edit here when automatic composition or composition-derived risk status changes.

### `src/hooks/useSuggestedPosition.ts`
- React wrapper around the shared composition engine.
- Edit here when UI-level composition dependencies change.

### `src/store/trackerSlice.ts`
- Local tracked-signal history and local risk-aware decision snapshots.
- Edit here when analytics should follow a different source of truth.
- Do not treat legacy persisted manual geometry fields as the current Step 3 truth.

## Canonical server analytics

### `api/server-setups.ts`
- Canonical setup-history API served by Vercel.
- Edit here when browser incremental refresh or canonical fetch filtering is wrong.

### `api/signal-accuracy.ts`
- Canonical signal-accuracy aggregation API.
- Edit here when server accuracy completeness or truncation handling is wrong.

### `api/upload-setups.ts`
- Protected browser-to-server setup upload path.
- Edit here when sync authorization or validation changes.

### `api/collector-heartbeat.ts`
- Collector liveness API.
- Edit here when heartbeat reporting or availability states are wrong.

## Collector runtime

### `src/server/collector/runCollector.ts`
- Canonical background writer for setups, setup settlement, tracked signals, tracked-signal settlement, and heartbeat.
- Edit here when canonical analytics are stale, under-counted, or not resolving.
- Risk: very high. This is one of the most critical files in the repo.

### `scripts/recompute-server-outcomes.ts`
- Repair tool for reconciling canonical setup outcomes after drift or outages.
- Edit here when backfill/reconciliation tooling is insufficient.
- This is a repair path, not the canonical runtime.

## Schema and deployment

### `supabase/*.sql`
- Database schema and indexes required for canonical analytics.
- Edit here when code expects new columns, tables, or indexes.

### `deploy/oracle/README.md`
- Oracle collector deployment and verification runbook.
- Edit here when operational steps change.

### `docs/production-parity-checklist.md`
- Authoritative release checklist for keeping browser, Vercel, Supabase, and Oracle in sync.

## Do not use these as the primary source of truth
- Legacy manual `riskInputs` geometry fields in persisted browser state
- Browser-local analytics when canonical endpoints are healthy
- Repair scripts when diagnosing live canonical collector behavior

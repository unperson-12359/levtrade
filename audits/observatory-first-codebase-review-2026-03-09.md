# Observatory-First Codebase Review

Date: `2026-03-09`

## Summary

The mounted product is the observatory shell in `src/App.tsx`. The largest architecture problem identified in the review was the legacy setup/tracker/canonical runtime that used to sit behind the global manager and store contracts. That dead branch has now been removed.

This review split the repo into:
- active observatory runtime
- legacy setup/risk/tracker surfaces
- legacy canonical/collector backend
- stale docs/tests that still describe the old architecture as primary

## Confirmed active runtime

- `src/App.tsx`
- `src/components/observatory/*`
- `src/hooks/useDataManager.ts`
- `src/hooks/useIndicatorObservatory.ts`
- `src/services/dataManager.ts`
- `src/observatory/engine.ts`
- `api/observatory-snapshot.ts`

## Immediate cleanup implemented

- Replaced the background manager with a live-only runtime:
  - websocket mids
  - candle polling
  - connection status
  - runtime diagnostics
- Removed the unused `src/hooks/useSystemHealth.ts` hook.
- Deleted the unmounted setup-history / live-setups / performance-dashboard hook-component chain.
- Rewrote engineering/release-contract docs to describe the observatory-first architecture.

## Legacy architecture removed

The repo cleanup removed:

- setup/tracker store slices
- setup/risk/tracker/decision workflow components that were no longer mounted
- canonical setup, signal-accuracy, heartbeat, and execution/backtest APIs
- collector runtime scripts and generated collector bundle
- legacy Supabase schema for server setups and tracked signals

## Remaining follow-up

- Add the real writer/backfill path for `observatory_indicator_states`.
- Decide whether the current chart/risk composition path should stay as-is or be simplified further around the boolean bar-state model.

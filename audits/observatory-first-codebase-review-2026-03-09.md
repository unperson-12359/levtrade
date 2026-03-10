# Observatory-First Codebase Review

Date: `2026-03-09`

## Summary

The mounted product is the observatory shell in `src/App.tsx`. The largest remaining architecture problem is not the observatory UI itself; it is the legacy setup/tracker/canonical runtime that was still executing in the background through the global data manager and store contracts.

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

## Legacy architecture still present

These areas are still in the repo but are no longer part of the mounted observatory path:

- `src/store/setupSlice.ts`
- `src/store/trackerSlice.ts`
- `src/components/setup/*`
- `api/server-setups.ts`
- `api/signal-accuracy.ts`
- `api/collector-heartbeat.ts`
- `api/upload-setups.ts`
- `src/server/collector/runCollector.ts`
- legacy Supabase tables for setup/tracker/canonical analytics

## Recommended next removals

- Remove the old source-check assertions in `tests/run-logic-tests.mjs` that still enforce unmounted workflow surfaces.
- Decide whether legacy collector/setup APIs stay as internal tooling or are removed entirely.
- Add the real writer/backfill path for `observatory_indicator_states` if observatory persistence is the target architecture.

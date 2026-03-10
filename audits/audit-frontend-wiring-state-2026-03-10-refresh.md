# Frontend Wiring / State Audit (Refresh)

## Current truth
- The browser runtime is now centered on `useDataManager`, `useIndicatorObservatory`, and the reduced Zustand store.
- The store shape is much cleaner than earlier revisions and no longer carries the old setup/risk slices.

## Findings
1. Confirmed improvement opportunity: `src/hooks/useDataManager.ts` still forces full candle refetches on every interval switch and selected-coin switch at lines 29-46 and 48-59. This is safe but heavier than needed now that the app only supports `4h` and `1d`.
2. Confirmed stale residue: the persisted store is clean, but old utility contracts remain detached from the mounted runtime. `src/utils/candleTime.ts`, `src/utils/contextFreshness.ts`, and `src/utils/format.ts` are no longer referenced by the active app.
3. Confirmed contract residue: `PriceContext.updatedAt` remains in the client/server contract even though nothing in the mounted UI reads it.

## Recommended fixes
- Replace full refetch-on-switch with a bounded refresh policy that only reloads the needed window for the newly selected market/interval.
- Delete the unused utility modules or move any truly reusable helpers into live observatory codepaths.
- Remove the unused `updatedAt` field from the shared price-context contract unless a real consumer is added.

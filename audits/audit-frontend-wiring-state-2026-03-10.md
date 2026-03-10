# Frontend Wiring / State Audit - 2026-03-10

## Current truth
- The live runtime is `useDataManager -> DataManager -> Zustand store -> useIndicatorObservatory -> ObservatoryLayout`.
- The store now contains only `marketDataSlice` and `uiSlice`.
- The mounted app does not use the removed setup/risk/signal slices anymore.

## Findings
### Medium - Dead UI persistence state is still in the store
- `src/store/uiSlice.ts:15-20` defines `expandedSections` and `toggleSection`.
- `src/components/shared/CollapsibleSection.tsx:19-20` is the only remaining consumer.
- `src/store/index.ts:61-77` still persists and sanitizes `expandedSections`, including legacy keys like `analytics`, `how-it-works`, and `menu`.
- Impact:
  - store shape and persistence rules still encode retired UI behavior
- Recommended fix:
  - remove `expandedSections`, `toggleSection`, and the related persistence merge logic when `CollapsibleSection` is deleted.

### Medium - Dead market-state actions remain in the live store contract
- `src/store/marketDataSlice.ts:11-18` still defines `errors`, `appendCandle`, and `clearErrors`.
- `appendCandle` is not used anywhere in `src/`, `api/`, or `tests`.
- `errors` is written by `src/services/dataManager.ts:79,97,109` but not surfaced in the mounted UI.
- `clearErrors` is only used by the mocked Playwright seed path (`tests/e2e/critical-flows.spec.ts:173`).
- Impact:
  - the store contract advertises behaviors the product no longer exposes
- Recommended fix:
  - either promote `errors` into visible diagnostics or remove the field and route all runtime reporting through `runtimeDiagnostics`.
  - delete `appendCandle` unless a real-time candle-updater is about to use it.

### Medium - `src/config/constants.ts` is mostly retired architecture residue
- Only `POLL_INTERVAL_MS` is referenced by the current source.
- Unused exports include:
  - `DEFAULT_ACCOUNT_SIZE` (`src/config/constants.ts:4`)
  - `SETUP_RETENTION_MS` (`src/config/constants.ts:7`)
  - `MAX_FUNDING_HISTORY` (`src/config/constants.ts:16`)
  - `SETUP_RESOLUTION_INTERVAL` (`src/config/constants.ts:20`)
- `rg -n` over `src api tests docs` returns no consumers beyond the constant file itself.
- Recommended fix:
  - collapse this file to the live observatory constants only, or split retired constants into an archive if they must stay for reference.

### Medium - `src/config/intervals.ts` still exposes retired interval and funding-era fields
- `src/config/intervals.ts:1-3` still exports `CandleInterval = '1h' | '4h' | '1d'` and `INTERVALS`.
- `src/components/observatory/ObservatoryLayout.tsx:17` only allows `['4h', '1d']`.
- `fundingLookbackMs` remains in the interval config (`src/config/intervals.ts:10,18,26,34`) even though funding is no longer part of the live observatory path.
- Impact:
  - type surfaces and config suggest capabilities the mounted app intentionally removed
- Recommended fix:
  - create a smaller observatory interval contract or rename the current file to make its scope explicit.

### Low - Test-only store injection is explicit and isolated
- `src/main.tsx:49-50` exposes `window.__LEVTRADE_STORE__` only under `VITE_E2E_MOCK === '1'`.
- This is acceptable current behavior, but it reinforces that the current E2E suite is mostly shell-level, not transport-level.

## Live vs stale
### Live
- `src/hooks/useDataManager.ts`
- `src/services/dataManager.ts`
- `src/store/marketDataSlice.ts` core price/candle/status behavior
- `src/store/uiSlice.ts` selected market and runtime diagnostics

### Stale or likely stale
- `expandedSections`
- `toggleSection`
- `appendCandle`
- hidden `errors` pipeline
- most of `src/config/constants.ts`
- `1h` / `fundingLookbackMs` parts of `src/config/intervals.ts`

## Risks if left as-is
- future edits keep preserving dead contracts because they are still first-class types
- store persistence remains harder to reason about than the product itself
- cleanup work will keep touching unrelated state just to satisfy old merge logic

## Recommended removals and fixes
- delete dead store fields/actions with the dead shared components
- shrink `src/config/constants.ts` to active constants
- split or simplify `src/config/intervals.ts` to match the mounted product
- decide whether `errors` should be visible or deleted

## Proof checks needed after fixes
- `npm.cmd run build`
- `node tests/run-logic-tests.mjs`
- targeted source checks confirming removed store fields no longer exist

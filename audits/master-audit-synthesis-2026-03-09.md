# Master Audit Synthesis - 2026-03-09

## Priority order
1. Fix stale canonical observatory state on coin/interval switch.
2. Fix canonical setup freshness semantics for incremental refresh.
3. Fix viewport-reactive heatmap density and shell/report accessibility semantics.
4. Add regression checks for the new fixes.
5. Queue collector hardening and navigation URL-state preservation as follow-up work.

## Safe-to-implement now
- `src/hooks/useIndicatorObservatory.ts`
- `api/server-setups.ts`
- `api/signal-accuracy.ts`
- `src/components/observatory/IndicatorClusterLanes.tsx`
- `src/components/observatory/ObservatoryLayout.tsx`
- `src/components/observatory/CandleReportPage.tsx`
- `tests/run-logic-tests.mjs`

## Follow-up backlog
1. Decide whether observatory and analytics routes should preserve coin/interval in the hash.
2. Clarify whether `/api/events/stream` should remain snapshot-style or become a true long-lived SSE feed.
3. Harden collector persistence/error surfacing and backlog visibility.
4. Reduce brittle source-text assertions in the logic suite in favor of behavior-level tests.

## Current implementation scope
- Apply the safe browser/API/accessibility fixes above.
- Do not change collector write semantics in this patch.

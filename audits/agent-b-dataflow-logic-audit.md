# Agent B - Dataflow and Logic Audit

## Goal
Audit the browser truth path for observatory state, canonical/local fallback behavior, and runtime orchestration.

## Files inspected
- `src/hooks/useIndicatorObservatory.ts`
- `src/services/dataManager.ts`
- `src/services/api.ts`
- `src/store/setupSlice.ts`
- `src/observatory/engine.ts`

## Findings
1. High - canonical observatory data can show the previous coin or interval briefly after a switch.
   - `useIndicatorObservatory.ts` keeps `remoteSnapshot` and `remotePriceContext` from the prior request until the next fetch resolves.
   - Impact: the shell can momentarily render stale canonical BTC data while the user has already switched to ETH or another interval.
   - Fix: clear remote state and fall back to the local snapshot immediately when `coin` or `canonicalInterval` changes.

2. High - canonical setup freshness can degrade incorrectly on incremental refreshes with no changed rows.
   - `DataManager.fetchServerSetupHistory()` trusts `/api/server-setups` freshness metadata directly.
   - The endpoint currently bases freshness on the filtered result set, so `updatedSince` queries with zero changed rows can look `delayed` even when canonical data is healthy.
   - Impact: the app can misreport canonical freshness and suggest degraded server health when nothing is actually wrong.
   - Fix: make `/api/server-setups` compute freshness from the latest canonical row overall, not only the incremental subset.

3. Medium - the runtime event feed is effectively a snapshot-over-SSE plus polling, not a persistent live stream.
   - `api/events/stream.ts` writes one SSE payload then ends the response; `DataManager` still maintains polling and reconciliation loops.
   - Impact: the naming suggests a stronger live guarantee than the implementation provides.
   - Fix: either keep the current design and document it as snapshot SSE, or convert it into a true long-lived stream.

4. Medium - the browser runtime still executes legacy setup/tracker pipelines even though the shipped shell is observatory-first.
   - `runCoreSignalPipeline()` continues to compute setups, tracker snapshots, and outcome resolution on every polling cycle.
   - Impact: unnecessary runtime work and higher maintenance surface for behavior the current shell does not foreground.
   - Fix: separate observatory-critical runtime work from legacy setup/tracker maintenance work in a later cleanup pass.

## Recommended next edits
- Fix the stale remote snapshot bug immediately.
- Fix canonical freshness semantics at the API boundary.
- Leave runtime pipeline decomposition as a follow-up cleanup after the truth-path fixes land.

## Review
- The first two findings are correctness issues, not just cleanup.
- The SSE/polling hybrid is acceptable short term but should be described accurately.
- The legacy pipeline overlap is real debt, but not the first patch to ship.

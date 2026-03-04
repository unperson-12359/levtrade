# Agent A — Setup Settlement Investigation

## Goal
Explain why some setup-history rows remain pending after their 72h window should have settled, then define the concrete fixes required.

## Files inspected
- `src/components/setup/SetupHistory.tsx`
- `src/utils/setupOutcomeFormat.ts`
- `src/signals/resolveOutcome.ts`
- `src/services/dataManager.ts`
- `src/store/setupSlice.ts`
- `src/server/collector/runCollector.ts`
- `api/server-setups.ts`

## Current behavior
- Setup History renders `4h`, `24h`, and `72h` outcomes from `TrackedSetup.outcomes`.
- Pending labels are derived from `generatedAt + windowMs`.
- Browser-side outcome resolution runs continuously against hydrated setup rows.
- Canonical server setup history was only fetched on initialization before this pass.
- Collector-side setup resolution only inspected the newest `100` setup rows per coin from the last 7 days.

## Expected behavior
- Once a setup reaches `generatedAt + 72h` and 1h candle coverage exists, its `72h` outcome should resolve to `win`, `loss`, or `expired`.
- If the server collector resolves a row, every browser should eventually pick up that canonical update without a full page reload.

## Findings
1. The screenshot itself was not sufficient proof of a bug.
   - A setup created on `March 2, 2026 at 10:17 AM` should remain pending for `72h` until `March 5, 2026 at 10:17 AM`.
   - That part of the UI math was correct.
2. There was a real canonical freshness bug.
   - The browser only hydrated server setup history once on startup.
   - If the collector later resolved the `72h` window, the browser would keep showing the older pending canonical row until reload.
3. There was a real collector truncation bug.
   - `resolveServerOutcomes()` only fetched the newest `100` setup rows per coin.
   - Older pending rows inside the 7-day lookback could be skipped permanently if setup volume exceeded that cap.

## Implemented fix
- Browser now refreshes canonical server setup history every `5 minutes` using an `updatedSince` incremental fetch.
- `/api/server-setups` now supports `updatedSince` filtering via `updated_at`.
- Collector setup resolution now paginates through up to `5,000` setup rows per coin instead of hard-capping at `100`.

## Open questions
- If setup volume grows above `5,000` rows per coin in the resolution lookback, collector pagination ceiling should be revisited.
- `scripts/recompute-server-outcomes.ts` still has a `2000` row cap and remains a repair utility rather than the hot path.

## Recommended next edits
- If users still report stale pending rows, inspect whether the collector is writing `updated_at` as expected in Supabase.
- If high-volume setup generation continues, add explicit canonical telemetry for “pending rows scanned per run” and “rows skipped by ceiling.”

## Risk level
- Medium before fix
- Low after fix, assuming the collector is running and Supabase `updated_at` is populated correctly

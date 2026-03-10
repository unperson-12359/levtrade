# Master Audit Synthesis - 2026-03-10

## Current repo truth
- The active product is the live observatory shell mounted from `src/App.tsx`.
- The live runtime is coherent:
  - browser websocket mids
  - browser candle polling
  - shared observatory engine
  - server snapshot hydration
  - Supabase boolean ledger
  - ledger-backed Analytics page
- The app currently builds and passes the existing logic and critical-flow suites.

## Confirmed broken or risky items, ranked
### 1. High - Secret-gated write routes still use `GET` and allow query-string secrets
- Files:
  - `api/persist-observatory-states.ts`
  - `api/backfill-observatory-states.ts`
  - `api/_observatoryPersistence.ts`
- Why it matters:
  - this is the clearest active security/ops flaw in the current product.

### 2. High - Release gate confidence is overstated
- Files:
  - `docs/release-signoff.md`
  - `scripts/release-gate.mjs`
  - `playwright.config.ts`
  - `tests/e2e/critical-flows.spec.ts`
- Why it matters:
  - the repo can claim release readiness while signoff is stale and transport wiring is still only lightly exercised.

### 3. Medium - Mounted store/config/frontend still contain dead observatory-adjacent residue
- Files:
  - `src/store/uiSlice.ts`
  - `src/store/marketDataSlice.ts`
  - `src/config/constants.ts`
  - `src/config/intervals.ts`
  - `src/components/shared/CollapsibleSection.tsx`
  - `src/components/shared/JargonTerm.tsx`
  - `src/components/shared/Tooltip.tsx`
  - `src/index.css`
- Why it matters:
  - the runtime is smaller than the codebase suggests, and cleanup is unfinished.

### 4. Medium - Truthfulness gaps remain around freshness semantics and analytics mixing
- Files:
  - `src/hooks/useIndicatorObservatory.ts`
  - `api/observatory-snapshot.ts`
  - `src/components/observatory/AnalyticsPage.tsx`
  - `supabase/observatory_indicator_states.sql`
- Why it matters:
  - the product is directionally correct, but some labels and persistence semantics are still looser than the underlying system deserves.

### 5. Medium - Browser/server duplication and repeated full-window fetching remain
- Files:
  - `src/services/api.ts`
  - `api/_hyperliquid.ts`
  - `src/services/dataManager.ts`
  - `api/observatory-snapshot.ts`
  - `api/_observatoryAnalytics.ts`
- Why it matters:
  - this is the biggest remaining maintainability/performance debt in the active architecture.

### 6. Medium - Repo artifacts still advertise the retired collector architecture
- Files and folders:
  - `deploy/oracle/*`
  - `supabase/app_state.sql`
  - `supabase/oi_snapshots.sql`
  - local `dist-server/`
  - local `.claude/worktrees/`
- Why it matters:
  - every broad search still rediscovers legacy architecture.

## Safe-to-delete or archive now
- `src/components/shared/CollapsibleSection.tsx`
- `src/components/shared/JargonTerm.tsx`
- `src/components/shared/Tooltip.tsx`
- dead store state tied to those components:
  - `expandedSections`
  - `toggleSection`
- dead constants in `src/config/constants.ts` other than `POLL_INTERVAL_MS`
- retired interval/funding fields in `src/config/intervals.ts` if no hidden consumer exists
- `deploy/oracle/*` if the Oracle collector path is truly retired
- `supabase/app_state.sql`
- `supabase/oi_snapshots.sql`
- local workspace artifacts:
  - `dist-server/`
  - `.claude/worktrees/`

## Items that need compatibility handling before cleanup
- `api/_signals.mjs` / `api/_signals.d.mts`
  - tracked generated bundle; must stay aligned during any further source cleanup
- analytics transition metrics
  - currently mixed from live snapshot and ledger
- route-state behavior
  - analytics/methodology URL semantics need a deliberate decision before change

## Recommended implementation order
1. Lock down operational safety
- Convert persistence/backfill to authenticated `POST`.
- Remove query-string secret support.
- Add explicit `maxDuration` for `api/observatory-analytics.ts`.

2. Fix release confidence
- Refresh `docs/release-signoff.md`.
- Tighten `scripts/release-gate.mjs` to validate freshness/hash.
- Add at least one non-mocked API smoke step.

3. Finish the runtime cleanup
- Remove dead shared components, dead store fields, dead constants, and dead interval config.
- Prune corresponding CSS.

4. Clean repo and workspace artifacts
- Archive or delete `deploy/oracle/*`.
- Remove unused root Supabase SQL files.
- Move `dist-server/` and `.claude/worktrees/` out of the repo root.

5. Improve truthfulness and maintainability
- Separate data observation time from fetch/build time.
- Add rule-version semantics for the ledger.
- Consolidate duplicated Hyperliquid and price-context helpers.

## Items that are acceptable current behavior
- shared observatory engine across browser/server/persistence
- boolean ledger design
- live shell using snapshot/local window while analytics is ledger-backed
- lean package dependency footprint

## Audit completion notes
- This audit was read-only with respect to product logic and runtime behavior.
- Only audit documentation and coordination log updates were added.
- Existing builds/tests were re-run and passed on the audited tree.

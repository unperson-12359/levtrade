# Frontend Surface Audit - 2026-03-10

## Current truth
- `src/App.tsx` mounts only `ObservatoryLayout`.
- The active user-facing product is `src/components/observatory/*` plus `src/components/chart/PriceChart.tsx`.
- Build, logic checks, and Playwright critical flows passed on the audited tree.

## Findings
### Medium - Analytics and methodology URLs are not shareable market views
- `src/hooks/useHashRouter.ts:52-56` builds `#/analytics` and `#/methodology` without `coin` or `interval`.
- `src/hooks/useHashRouter.ts:33-41` can parse `coin` and `interval`, but only the report route actually writes them (`buildReportHash`, `src/hooks/useHashRouter.ts:44-49`).
- Impact:
  - deep links to analytics or methodology reopen whatever coin/interval the browser store last persisted
  - copied URLs do not fully describe the visible market context
- Recommended fix:
  - carry `coin` and `interval` through analytics and methodology hashes, or explicitly reset those pages to a documented default.

### Medium - Dead shared UI is still present inside the mounted frontend tree
- `src/components/shared/CollapsibleSection.tsx`, `src/components/shared/JargonTerm.tsx`, and `src/components/shared/Tooltip.tsx` have no consumers in `src/` or `tests/`.
- `rg -n "CollapsibleSection|JargonTerm|Tooltip" src tests` only returns the component files themselves.
- Impact:
  - search results and editor autocomplete still suggest retired surface primitives
  - dead store state and CSS continue to survive because these components still exist
- Recommended fix:
  - delete these components together with the state and CSS they are the last consumers of.

### Medium - `src/index.css` still carries large retired surface blocks
- The mounted app now uses `obs-*` classes, but `src/index.css` still includes old selector groups such as:
  - `.risk-*` (`src/index.css:1829-2104`)
  - `.decision-*` (`src/index.css:2793-2899`)
  - `.setup-*` / `.workflow-*` (`src/index.css:2300-2431`, `src/index.css:2789`, `src/index.css:3106`)
  - `.perf-*` (`src/index.css:3548-3669`)
  - `.jargon-term` (`src/index.css:3308`)
- Impact:
  - stylesheet size and maintenance cost stay inflated
  - it is harder to tell which visual system is live
- Recommended fix:
  - prune CSS in the same batches as dead component deletion; keep only selectors referenced by mounted observatory files.

### Low - No confirmed mounted display blocker was found in the current shell
- Verified paths:
  - observatory shell
  - report page
  - analytics page
  - methodology page
  - network view
- Current surface copy is largely aligned with the live-first observatory story.

## Live vs stale
### Live
- `src/components/observatory/*`
- `src/components/chart/PriceChart.tsx`
- `src/components/system/AppErrorBoundary.tsx`

### Stale or likely stale
- `src/components/shared/CollapsibleSection.tsx`
- `src/components/shared/JargonTerm.tsx`
- `src/components/shared/Tooltip.tsx`
- non-`obs-*` CSS blocks tied to retired setup/risk/decision surfaces

## Risks if left as-is
- users cannot reliably share analytics or methodology views for a specific market context
- frontend cleanup will keep stalling because dead UI still looks first-party
- CSS regressions become harder to reason about

## Recommended removals and fixes
- Remove the dead shared components and their CSS.
- Thread `coin` and `interval` through analytics and methodology routes.
- After CSS pruning, re-run responsive checks on the observatory shell and report page.

## Proof checks needed after fixes
- `npm.cmd run build`
- `node tests/run-logic-tests.mjs`
- `npm.cmd run test:e2e:critical`
- manual checks:
  - copy/paste `#/analytics?...` and `#/methodology?...` URLs
  - verify no visual regressions after CSS deletion

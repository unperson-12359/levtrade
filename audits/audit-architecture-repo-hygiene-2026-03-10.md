# Architecture / Repo Hygiene Audit - 2026-03-10

## Current truth
- The mounted product boundary is small and clear:
  - `src/App.tsx`
  - `src/components/observatory/*`
  - `src/components/chart/PriceChart.tsx`
  - `src/hooks/useDataManager.ts`
  - `src/hooks/useIndicatorObservatory.ts`
  - the four active API routes
- The repo still contains multiple files and folders that describe a retired collector/setup architecture.

## Findings
### High - Deployment docs still describe a removed collector architecture
- `deploy/oracle/README.md:1-83` still documents:
  - "Oracle VM collector deployment"
  - `npm run build:collector`
  - `api/_collector.mjs`
  - `collector_heartbeat`
  - `/api/signal-accuracy`
- `deploy/oracle/levtrade-collector.service:2-10` still starts `npm run collector:start`.
- `package.json` no longer defines those scripts, and the mounted app no longer exposes those APIs.
- Impact:
  - the repo still ships an operational playbook for infrastructure that no longer exists in the active product
- Recommended fix:
  - archive or delete `deploy/oracle/*` unless there is an explicit internal plan to revive it.

### Medium - Root Supabase schema folder still carries unused tables from the retired architecture
- `supabase/observatory_indicator_states.sql` is the live ledger schema.
- `supabase/app_state.sql` and `supabase/oi_snapshots.sql` have no consumers in `src/`, `api/`, `tests/`, `docs/`, `deploy/`, `package.json`, or `vercel.json`.
- Impact:
  - the root schema folder still suggests multiple active persistence systems
- Recommended fix:
  - archive or remove the unused SQL files, or document them as legacy if they must stay temporarily.

### Medium - Generated API bundle is part of the active contract and requires build discipline
- `api/_signals.mjs` and `api/_signals.d.mts` are tracked files (`git ls-files` confirms both).
- The active API routes import the generated bundle rather than source modules directly.
- Impact:
  - source changes are not complete until the bundle is rebuilt
  - commit hygiene matters more than in a source-only repo
- Recommended fix:
  - keep the bundle only if Vercel/runtime constraints require it
  - otherwise consider generating it only in CI/build output instead of tracking it
  - if it stays tracked, keep the bundle drift test mandatory.

### Low - Prior audits are mixed with current repo state
- `audits/` contains several older track docs from earlier architecture phases alongside the current observatory-first audit documents.
- This is acceptable, but the folder now needs clearer archival naming or an index to avoid mixing superseded and current guidance.

## Live vs stale
### Live
- active observatory source tree
- `supabase/observatory_indicator_states.sql`
- `docs/engineering-map.md`
- `docs/production-parity-checklist.md`

### Stale or likely stale
- `deploy/oracle/*`
- `supabase/app_state.sql`
- `supabase/oi_snapshots.sql`
- older audit docs that predate the final observatory-only cutover

## Risks if left as-is
- operators will follow the wrong deployment model
- schema ownership remains ambiguous
- future cleanup passes will keep rediscovering the same "maybe still live?" artifacts

## Recommended removals and fixes
- delete or archive `deploy/oracle/*`
- delete or archive unused root Supabase SQL files
- either formalize tracked bundle policy or stop tracking generated bundle output
- add an audit index or archive prefix in `audits/`

## Proof checks needed after fixes
- `npm.cmd run build`
- `node tests/run-logic-tests.mjs`
- manual repo scan:
  - no current docs mention collector-only release steps
  - root Supabase folder matches the active product architecture

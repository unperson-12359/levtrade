# Dependencies / Artifacts / Workspace Audit - 2026-03-10

## Current truth
- `package.json` is lean:
  - runtime deps: `react`, `react-dom`, `zustand`, `lightweight-charts`, Tailwind/Vite integration
  - dev deps: Playwright, TypeScript, Vite plugin, Node/React typings
- No collector-specific packages or scripts remain in the active manifest.
- The workspace still contains several local/generated artifact trees that can mislead repo-wide searches.

## Findings
### High - `.claude/worktrees/` contains full historical repo copies of the retired architecture
- `.claude/worktrees/agent-a6d43fc9`
- `.claude/worktrees/agent-acd79d64`
- `.claude/worktrees/agent-aeb8ad93`
- These directories contain:
  - old APIs like `api/server-setups.ts`, `api/collector-heartbeat.ts`, `api/compute-signals.ts`
  - old store slices, hooks, and components
  - old Supabase schemas like `server_setups.sql`, `collector_heartbeat.sql`, `tracked_signals.sql`
- Impact:
  - repo-wide search results are polluted
  - humans and tools can mistake historical worktrees for live code
- Recommended fix:
  - move these worktrees outside the repo root or add a clear search-ignore convention for local tooling.

### Medium - Local `dist-server/` still contains retired collector bundles
- Present files:
  - `dist-server/run-collector.mjs`
  - `dist-server/collector-loop.mjs`
  - `dist-server/recompute-server-outcomes.mjs`
  - `dist-server/server-setups-check.mjs`
- The current `package.json` and `vercel.json` do not use them.
- `dist-server/run-collector.mjs` and `dist-server/collector-loop.mjs` still reference `server_setups`, `collector_heartbeat`, and `tracked_signals`.
- Impact:
  - local workspace artifacts still imply a live collector runtime
- Recommended fix:
  - remove the directory from the workspace if it is no longer needed, or archive it outside the repo root.

### Low - The tracked dependency surface is otherwise healthy
- `vite.config.ts` uses the declared Vite/React/Tailwind dependencies.
- The chart layer uses `lightweight-charts`.
- State uses `zustand`.
- No obvious dependency bloat or manifest drift was found in the active app.

### Low - Expected local artifact directories are present
- `.vercel/`
- `dist/`
- `test-results/`
- `node_modules/`
- These are normal local build/test artifacts and not current blockers.

## Live vs stale
### Live
- `package.json`
- `package-lock.json`
- `vite.config.ts`

### Stale or likely stale
- `.claude/worktrees/`
- `dist-server/`

## Risks if left as-is
- future audits and refactors will continue to pick up dead legacy paths
- local artifact confusion will slow down every repo-wide search

## Recommended removals and fixes
- move or remove `.claude/worktrees/`
- remove or archive `dist-server/`
- keep dependency footprint lean; no urgent manifest changes are needed

## Proof checks needed after fixes
- repo-wide `rg` results no longer include old collector/setup files unless explicitly targeting archives
- `npm.cmd run build`
- `node tests/run-logic-tests.mjs`

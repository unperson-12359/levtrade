# Dependencies / Artifacts / Workspace Audit (Refresh)

## Current truth
- Runtime dependencies are lean and appropriate for the current observatory product.
- Generated bundle drift is currently controlled by the logic checks and build pipeline.

## Findings
1. Acceptable current behavior: the production dependency set is small and aligned with the mounted app.
2. Confirmed local artifact residue: ignored local folders like `dist-server/` and `test-results/` still exist in the workspace and can mislead future reviews even though they are not tracked.
3. Confirmed audit/process clutter: the `audits/` directory now contains multiple generations of agent and synthesis files with overlapping names. That is manageable, but it should be indexed or archived more clearly before the next long review cycle.

## Recommended fixes
- Keep the dependency set as-is for now.
- Add a simple archive/index convention for audits so “current” and “historical” reviews are obvious.
- Consider clearing local ignored build artifacts before future repo-wide review passes to reduce false leads.

# Frontend Surface Audit (Refresh)

## Current truth
- The mounted product is still the observatory shell in `src/components/observatory/*`.
- The live shell, methodology page, analytics page, and candle report all still render from the current route structure.
- The UI is materially functional, but the main critical interaction path is no longer green in browser automation.

## Findings
1. Confirmed issue: the main critical flow is unstable after returning from methodology to the observatory. `tests/e2e/critical-flows.spec.ts` times out on the first heatmap click at lines 34-37 even though the same heatmap path passes in a simpler test path. This makes the primary shell flow non-releaseable until fixed.
2. Confirmed issue: the heatmap lives inside animated panels, and the click target sits in a rapidly re-rendered area. `src/index.css` still applies `panel-emerge` to `.obs-panel` at lines 645-650 while the heatmap cells themselves are interactive at lines 7241-7243. That combination is the most likely cause of the "element not stable / detached" Playwright failure.
3. Confirmed stale residue: `src/index.css` still contains large blocks for retired setup/risk/decision/history surfaces. The current mounted app no longer uses those selectors, but they still dominate the stylesheet and make future frontend work harder.

## Recommended fixes
- Stabilize the methodology -> observatory -> heatmap click path first. Either remove the remount/animation race or make the critical test wait for the route/state to settle before clicking the first heatmap cell.
- Limit panel animation on already-mounted interactive observatory panels, especially the heatmap rail.
- Run a CSS-only cleanup pass to delete retired setup/risk/decision selectors after the runtime path is stable.

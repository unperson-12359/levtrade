# Full-Stack Flow Audit (Refresh)

## Current truth
- The app still follows the intended flow: browser live shell -> server snapshot hydration -> persistence ledger -> analytics ledger reads.
- Production-oriented architecture is coherent enough for the current feature set.

## Findings
1. Confirmed issue: the end-to-end browser flow is not fully green because `npm.cmd run test:e2e:critical` fails on the methodology-return heatmap interaction path.
2. Confirmed issue: release verification is also not green because `node scripts/release-gate.mjs --verify-only` fails against the stale signoff candidate.
3. Confirmed improvement opportunity: the current app still has duplicated browser/server price fetch logic and heavier-than-needed interval/coin refetches, which increases drift and latency risk.

## Recommended fixes
- Fix the critical browser flow and restore a green E2E baseline before any more product changes.
- Refresh release signoff whenever a new production candidate is pushed.
- After those are green, simplify the fetch split and reduce redundant full-window reloads.

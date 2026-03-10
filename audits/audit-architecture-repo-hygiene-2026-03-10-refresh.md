# Architecture / Repo Hygiene Audit (Refresh)

## Current truth
- The active architecture is finally observatory-first.
- The repo is much cleaner than the earlier setup/tracker state, but some dead residue still exists.

## Findings
1. Confirmed stale residue: `src/utils/candleTime.ts` still contains setup-window semantics and is no longer used by the mounted product.
2. Confirmed stale residue: `src/utils/contextFreshness.ts` and `src/utils/format.ts` are detached from the live observatory and still expose legacy formatting concepts like funding-rate formatting.
3. Confirmed stale residue: `src/index.css` still contains large blocks for removed setup/risk/decision/history surfaces even though the runtime files are gone.

## Recommended fixes
- Delete the dead utility modules outright unless a live consumer is reintroduced in the same pass.
- Do a targeted stylesheet purge for retired selector families to reduce confusion and maintenance cost.

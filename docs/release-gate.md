# Release Gate

This is the hard-freeze release gate for LevTrade stabilization.  
A release candidate is blocked until all required automated and manual checks are complete.

## Commands

```powershell
# Full gate: build + logic + critical E2E + signoff verification
npm.cmd run gate:release

# Verify signoff document only
node scripts/release-gate.mjs --verify-only

# Real production smoke
npm.cmd run smoke:release -- --base-url https://levtrade.vercel.app --coin BTC --interval 4h --days 180
```

## Required signoff file

- Default path: `docs/release-signoff.md`
- Override path: set `RELEASE_SIGNOFF_PATH`

The gate script requires the signoff file to include:

- `Status: PASS`
- a recent `Date`
- a `Candidate` hash matching the current release candidate or the immediately preceding candidate commit
- checked lines for:
  - `Automated: npm run build`
  - `Automated: npm run test:logic`
  - `Automated: npm run test:e2e:critical`
  - `Automated: npm run smoke:release`
  - `Manual: Responsive matrix`
  - `Manual: Live shell continuity verification`
  - `Manual: Ledger freshness verification`

## Critical E2E scope

`tests/e2e/critical-flows.spec.ts` covers:

1. App load, coin switch, interval switch, price chart, and cluster heatmap render
2. Heatmap cell navigation into the candle report route and return to the heatmap
3. Timeline/network and basic/advanced mode interactions, including indicator drilldown
4. Health detail and runtime diagnostics visibility from the command bar
5. Runtime diagnostics visibility without losing the observatory shell

## Verification intent

- `Live shell continuity verification` means confirming the observatory shell stays readable through refresh, route changes, and transient network interruptions without surfacing retired setup/tracker architecture.
- `Ledger freshness verification` means confirming the production `observatory_indicator_states` table has recent rows for every tracked `coin + interval` pair before you claim the analytics ledger is healthy.

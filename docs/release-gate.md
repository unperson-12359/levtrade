# Release Gate

This is the hard-freeze release gate for LevTrade stabilization.  
A release candidate is blocked until all required automated and manual checks are complete.

## Commands

```powershell
# Full gate: build + logic + critical E2E + signoff verification
npm.cmd run gate:release

# Verify signoff document only
node scripts/release-gate.mjs --verify-only
```

## Required signoff file

- Default path: `docs/release-signoff.md`
- Override path: set `RELEASE_SIGNOFF_PATH`

The gate script requires the signoff file to include:

- `Status: PASS`
- checked lines for:
  - `Automated: npm run build`
  - `Automated: npm run test:logic`
  - `Automated: npm run test:e2e:critical`
  - `Manual: Responsive matrix`
  - `Manual: 10+ minute production soak`
  - `Manual: Trust source verification`

## Critical E2E scope

`tests/e2e/critical-flows.spec.ts` covers:

1. App load, coin switch, interval switch, and chart presence
2. Step lock state and readiness `%` parity with light count
3. Canonical vs fallback setup-history messaging
4. Analytics drawer tab interactions
5. Runtime diagnostics visibility without losing app shell

# Master Audit Synthesis (Refresh)

## Current truth
- The observatory-first architecture is still the right product shape.
- The repo is no longer carrying the old setup/tracker runtime, but it is not "clean" yet.
- Current verification state:
  - `npm.cmd run build` PASS
  - `npm.cmd run test:logic` PASS
  - `npm.cmd run test:e2e:critical` FAIL
  - `node scripts/release-gate.mjs --verify-only` FAIL

## Ranked findings
1. Critical: the main critical browser flow is red. `tests/e2e/critical-flows.spec.ts` fails on the methodology -> observatory -> heatmap click path, which blocks clean release confidence.
2. High: the release signoff is stale. `docs/release-signoff.md` still signs off candidate `f7b4e12`, so the gate fails for the current head.
3. Medium: the ledger has no persisted `rule_version`, so historical truth becomes ambiguous as soon as the indicator rules change.
4. Medium: the public price-context contract still carries an unused `updatedAt` field, and the server `observedAt` semantics are still "request time" rather than true market observation time.
5. Medium: dead residue remains in `src/utils/*` and especially `src/index.css`, where large retired setup/risk/decision selector families still exist.
6. Medium: browser/server request logic is still duplicated, and the browser still performs full candle refetches on coin/interval switches.
7. Low: local ignored artifacts (`dist-server/`, `test-results/`) and overlapping audit generations add review noise.

## Next implementation batch
1. Fix the failing critical E2E path and stabilize the heatmap interaction after returning from methodology to observatory.
2. Refresh release signoff so `release-gate` verifies the current candidate again.
3. Add `rule_version` to the ledger schema and write path.
4. Remove dead `src/utils/*` residue and then do a CSS-only purge of retired setup/risk/decision selectors.
5. Consolidate Hyperliquid request helpers and reduce full refetches on coin/interval switches.

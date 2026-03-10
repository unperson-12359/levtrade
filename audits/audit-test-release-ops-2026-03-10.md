# Test / Release / Ops Audit - 2026-03-10

## Current truth
- Current automated checks pass:
  - `npm.cmd run build`
  - `node tests/run-logic-tests.mjs`
  - `npm.cmd run test:e2e:critical`
- The suite covers the mounted observatory shell, but not all production wiring.

## Findings
### High - Release gate can pass with stale signoff metadata
- `docs/release-signoff.md:3-4` still names:
  - date `2026-03-08`
  - candidate `d9e84ed`
- `docs/release-signoff.md:19` still points to an older production deployment URL.
- `scripts/release-gate.mjs:32-50` only checks for the presence of checkbox-style patterns and does not validate:
  - current commit hash
  - signoff freshness
  - deployment freshness
- Impact:
  - release automation can report green while the signoff file is operationally stale
- Recommended fix:
  - make the release gate validate date freshness and candidate hash, or regenerate signoff as part of release flow.

### High - Playwright critical flows are mocked, not production-wiring tests
- `playwright.config.ts` starts the dev server with `VITE_E2E_MOCK=1`.
- `src/main.tsx:49-50` exposes `window.__LEVTRADE_STORE__` only for that mock mode.
- `tests/e2e/critical-flows.spec.ts:131-184` seeds candles and prices directly into the store.
- Impact:
  - the suite verifies shell behavior, not real websocket, snapshot, analytics, or persistence wiring
- Recommended fix:
  - keep the current mock suite for UI determinism
  - add at least one non-mocked smoke path for snapshot and analytics APIs.

### Medium - Logic tests are heavily source-shape oriented
- `tests/run-logic-tests.mjs` is valuable for contract drift and bundle drift, but much of it is regex/source inspection rather than black-box behavior.
- Impact:
  - the suite gives strong structure regression coverage but limited semantic confidence
- Recommended fix:
  - add more behavioral tests around:
    - analytics aggregation from ledger rows
    - snapshot/local freshness semantics
    - persistence route auth and method handling

### Medium - No automated operational freshness check exists for the ledger writer
- There is no test or runbook step in the active release documents that proves:
  - the cron wrote recently
  - row counts are still increasing
  - the latest persisted bar is within an expected lag window
- Recommended fix:
  - add a lightweight post-deploy ops check for ledger freshness.

## Live vs stale
### Live
- build
- logic suite
- mock Playwright critical flow
- `docs/production-parity-checklist.md`

### Stale or likely stale
- `docs/release-signoff.md` contents
- release-gate assumptions that signoff text alone is enough

## Risks if left as-is
- release confidence remains overstated
- production transport or persistence regressions can slip past automated checks

## Recommended removals and fixes
- tighten `scripts/release-gate.mjs`
- refresh or automate `docs/release-signoff.md`
- add non-mocked smoke coverage for active APIs
- add a ledger freshness verification step

## Proof checks needed after fixes
- `npm.cmd run build`
- `node tests/run-logic-tests.mjs`
- `npm.cmd run test:e2e:critical`
- new smoke checks:
  - `/api/observatory-snapshot`
  - `/api/observatory-analytics`
  - authenticated persistence route method/auth enforcement

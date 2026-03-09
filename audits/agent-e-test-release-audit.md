# Agent E - Test and Release Audit

## Goal
Audit the current regression net and release documentation against the shipped observatory product.

## Files inspected
- `tests/run-logic-tests.mjs`
- `tests/e2e/critical-flows.spec.ts`
- `docs/release-gate.md`
- `docs/release-signoff.md`

## Findings
1. Medium - the logic suite still relies heavily on source-text assertions.
   - Many checks validate that strings or `data-testid` markers exist rather than exercising behavior.
   - Impact: regressions in state semantics can slip through if the right text remains in the file.
   - Fix: where practical, replace brittle source checks with behavioral assertions around pure helpers or route/state helpers.

2. Medium - critical E2E coverage does not currently protect the newly discovered stale-canonical-snapshot bug.
   - The E2E flow seeds state and clicks through views, but it does not assert that a coin switch immediately reflects the new context while canonical loading is in flight.
   - Fix: add a regression guard in the logic suite for the hook reset behavior and consider an E2E assertion around URL/context preservation later.

3. Low - accessibility regressions are not covered.
   - No automated checks currently assert toggle semantics or labeled report navigation controls.
   - Fix: add targeted expectations or source guards for the new accessibility attributes in this pass.

4. Low - release docs cover the shipped observatory well, but they do not call out the SSE-plus-polling nuance or the incremental freshness caveat.
   - Fix: fold those into docs when the runtime semantics are intentionally clarified.

## Recommended next edits
- Add regression checks for the hook reset and the new accessibility attributes in this pass.
- Leave deeper test-suite redesign for a later cleanup cycle.

## Review
- The current regression net is workable for fast iteration, but it needs a few focused additions to cover the bugs found in this audit.

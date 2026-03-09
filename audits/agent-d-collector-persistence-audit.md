# Agent D - Collector and Persistence Audit

## Goal
Audit canonical data generation, persistence, and settlement behavior for the collector-backed analytics stack.

## Files inspected
- `src/server/collector/runCollector.ts`
- `src/signals/api-entry.ts` via collector imports
- `supabase/*.sql` naming and documented required tables
- `docs/production-parity-checklist.md`

## Findings
1. High - setup and signal resolution loops have silent ceilings.
   - `runCollector.ts` caps setup and tracked-signal resolution at `5,000` rows per run.
   - Impact: a backlog can remain partially unresolved without an explicit operator signal, producing under-settled canonical analytics.
   - Fix: surface truncation in collector output/heartbeat/events or keep paging until exhaustion with stronger safeguards.

2. High - several persistence paths swallow failures that matter operationally.
   - Examples: `persistOISnapshot()` does not inspect `response.ok`; multiple collector branches use broad `catch {}` fallbacks.
   - Impact: canonical drift can grow silently, especially around OI history and outcome reconciliation.
   - Fix: convert silent failures into explicit runtime diagnostics or event records.

3. Medium - duplicate detection is intentionally coarse.
   - `checkDuplicate()` only inspects the latest recent row for the same scope/coin/direction and compares entry drift.
   - Impact: this is probably acceptable operationally, but it is worth documenting as a tradeoff instead of treating it as exact dedupe.

4. Medium - collector success reporting is stronger than persistence verification.
   - The heartbeat updates even when some side writes fail quietly.
   - Impact: operators may see a healthy collector while parts of the analytics pipeline are degraded.
   - Fix: include partial-failure state in heartbeat or execution events.

## Recommended next edits
- Do not change collector behavior in the first frontend/API patch.
- Create a dedicated collector hardening pass next, focused on error surfacing and backlog visibility.

## Review
- The collector issues are real but more invasive than the current browser/API fixes.
- They need careful rollout because they affect canonical write behavior, not just presentation.

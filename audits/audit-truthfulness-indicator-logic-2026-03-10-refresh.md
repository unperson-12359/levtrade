# Truthfulness / Indicator Logic Audit (Refresh)

## Current truth
- The indicator engine is deterministic and price/candle-driven.
- The persistence layer writes a boolean ledger to `observatory_indicator_states`.
- Analytics now read persisted history instead of only the visible snapshot window.

## Findings
1. Confirmed truthfulness gap: the ledger schema in `supabase/observatory_indicator_states.sql` stores `coin`, `interval`, `candle_time`, `indicator_id`, `category`, and `is_on`, but no `rule_version`. Once rules change, historical rows become ambiguous.
2. Confirmed truthfulness gap: the persistence writer returns `rulesetVersion` in runtime results, but it is not persisted with rows. `api/_observatoryPersistence.ts` lines 73-83 report the version, while lines 132-139 omit it from persisted rows.
3. Confirmed contract residue: `src/observatory/priceContext.ts` exposes both `observedAt` and `updatedAt`, but only `observedAt` is surfaced in the UI. The extra field increases contract surface without product value.

## Recommended fixes
- Add `rule_version` to the ledger schema and write path before more indicator changes land.
- Backfill should keep writing through the same codepath, but once versioned, it should write the active ruleset version as part of each row or versioned key.
- Remove unused time fields from the public shell contract or explicitly document their semantics.

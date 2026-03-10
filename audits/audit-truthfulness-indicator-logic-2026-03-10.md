# Truthfulness / Indicator Logic Audit - 2026-03-10

## Current truth
- The observatory engine is shared across:
  - browser local fallback
  - server snapshot generation
  - persistence writer
  - persisted analytics aggregation
- The current engine emits `36` indicators across `Trend`, `Momentum`, `Volatility`, `Volume`, and `Structure`.
- Flow/funding/OI categories are no longer part of the mounted observatory logic.

## Findings
### Medium - Freshness timestamps represent fetch/build time, not underlying market observation time
- `src/hooks/useIndicatorObservatory.ts:129` returns `updatedAt: new Date().toISOString()` even when there are no candles.
- `src/hooks/useIndicatorObservatory.ts:147` also stamps local price context with `new Date().toISOString()`.
- `api/observatory-snapshot.ts:118` stamps server `priceContext.updatedAt` with the current server time.
- `api/observatory-snapshot.ts:62` sets `lastSuccessfulAtMs` to `generatedAt`, which is request completion time, not bar timestamp.
- Impact:
  - the UI label "Updated" can be read as market-data timestamp even though it is really fetch/build time
  - freshness metadata tracks endpoint success, not strict market recency
- Recommended fix:
  - distinguish `observedAt` / `latestBarTime` / `snapshotBuiltAt`
  - surface the right one in the shell copy

### Medium - The analytics page still mixes ledger stats with snapshot-window metadata
- `src/components/observatory/AnalyticsPage.tsx:271-287` merges ledger rows with live snapshot indicator metadata.
- `src/components/observatory/AnalyticsPage.tsx:297` uses `indicator.frequency.stateTransitionRate`, which is still computed from the current snapshot window rather than the persisted ledger.
- Impact:
  - most analytics values are ledger-backed, but the inspector still mixes in live-window transition semantics
- Recommended fix:
  - either label mixed fields clearly or move transition-rate calculations into the ledger analytics builder.

### Medium - The ledger has no rule/version provenance
- `supabase/observatory_indicator_states.sql` stores:
  - `id`
  - `coin`
  - `interval`
  - `candle_time`
  - `indicator_id`
  - `category`
  - `is_on`
  - `created_at`
- `src/observatory/engine.ts:490-503` makes the row identity deterministic by `coin:interval:bar:indicator`.
- Impact:
  - if indicator formulas or thresholds change, a backfill silently rewrites history with no version marker
  - historical analytics cannot explain which rules produced a given row set
- Recommended fix:
  - add `rule_version` or equivalent migration/version semantics before the indicator set changes again.

### Low - The engine is deterministic and shared correctly
- `src/observatory/engine.ts` is the single indicator engine.
- `src/observatory/persistence.ts` filters closed bars using interval-aware time logic.
- `src/observatory/analytics.ts` rebuilds persistence analytics from boolean rows.
- This is the strongest part of the current architecture.

### Low - The current engine is not "price only"
- `src/observatory/engine.ts:81-113` derives series from `volume` and `trades` as well as OHLC.
- `src/types/market.ts:16-25` defines candle payloads with `volume` and `trades`.
- This is truthful to the codebase, but it is worth documenting because "price-only" is not the current implementation.

## Live vs stale
### Live
- `src/observatory/engine.ts`
- `src/observatory/persistence.ts`
- `src/observatory/analytics.ts`
- `supabase/observatory_indicator_states.sql`

### Stale or likely stale
- none inside the current engine path
- the main risk is missing provenance, not dead code

## Risks if left as-is
- operators and users can over-trust "Updated" as a data timestamp
- future indicator tweaks can silently rewrite historical meaning
- analytics explanations remain partly mixed between live window and ledger

## Recommended removals and fixes
- separate market observation time from fetch/build time
- add rule-version semantics to the ledger before more indicator changes land
- finish the move of analytics-only metrics to ledger-derived calculations

## Proof checks needed after fixes
- unit tests for timestamp semantics
- regression tests for ledger analytics versus snapshot analytics
- migration/backfill test proving versioned rows can be distinguished

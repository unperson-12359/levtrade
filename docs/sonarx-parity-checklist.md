# SonarX Production Parity Checklist (Supabase / Vercel / Oracle)

Date: 2026-03-04

This checklist defines what must be true before SonarX can be considered production-ready in our current stack.

## 1) Data Contract Parity
- [ ] Canonical candle schema agreed (`time`, `open`, `high`, `low`, `close`, `volume`, `trades`).
- [ ] Timezone and bucket boundaries are identical to current pipeline.
- [ ] Asset symbol mapping is deterministic (`BTC`, `ETH`, `SOL`, etc.).
- [ ] Missing/late data behavior is explicit and testable.

## 2) Oracle Collector Parity
- [ ] SonarX ingestion worker runs on Oracle without changing current collector stability.
- [ ] Backfill path supports bounded replay windows.
- [ ] Stream disconnect/retry policy is implemented and logged.
- [ ] Derived candle aggregation job produces deterministic results for the same input window.

## 3) Supabase Parity
- [ ] New raw SonarX tables are isolated from current production candle tables.
- [ ] Derived candle table has indexes for `(coin, timeframe, time)` read paths.
- [ ] Upsert strategy prevents duplicate candle rows.
- [ ] Retention policy defined for raw snapshots/trades data.
- [ ] Data quality flags stored (source lag, bucket completeness, validation outcome).

## 4) Vercel API / Client Parity
- [ ] API can read either provider (`current`, `sonarx`) via explicit provider routing.
- [ ] Default provider remains current source until cutover.
- [ ] Client receives provider provenance metadata for debugging.
- [ ] No regression in existing setup settlement and tracker paths.

## 5) Validation Gates (Must Pass)
- [ ] Candle divergence: close price delta stays inside agreed threshold.
- [ ] Indicator divergence: z-score, ATR, and composite direction parity thresholds pass.
- [ ] Setup generation parity: direction/grade alignment measured over sample period.
- [ ] 72h settlement path remains unchanged and verified.

## 6) Rollout Gates
- [ ] Stage 1: shadow mode only (no user-visible provider switch).
- [ ] Stage 2: internal read toggle for side-by-side comparisons.
- [ ] Stage 3: canary subset of assets/timeframes.
- [ ] Stage 4: full cutover with rollback switch preserved.

## 7) Monitoring and Alerting
- [ ] Ingestion lag dashboard.
- [ ] Missing bucket dashboard.
- [ ] Divergence alerting (current provider vs SonarX derived series).
- [ ] Error budget and auto-disable trigger for provider fallback.

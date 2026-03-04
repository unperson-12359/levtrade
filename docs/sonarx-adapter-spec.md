# SonarX Adapter Spec (Design Spike)

Date: 2026-03-04

## Objective
Add SonarX as an optional upstream data provider without changing existing signal or settlement logic.

## Scope
In scope:
- Provider-tagged ingestion and derived candle pipeline.
- Read-path provider routing in API layer.
- Validation hooks to compare current provider vs SonarX-derived candles.

Out of scope:
- Immediate production cutover.
- Rewriting indicator math.
- Changing workflow Step 1/2/3 business rules.

## Proposed Interfaces

### Provider Enum
```ts
type MarketDataProvider = 'current' | 'sonarx'
```

### Candle Row (Canonical)
```ts
interface CanonicalCandle {
  coin: string
  timeframe: '1m' | '5m' | '1h'
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  trades: number
  provider: MarketDataProvider
  quality: 'full' | 'partial' | 'backfilled'
  createdAt: number
  updatedAt: number
}
```

### API Read Option
```ts
interface CandleFetchOptions {
  provider?: MarketDataProvider
  since?: string
  limit?: number
}
```

Default behavior:
- `provider` omitted => `current`

## Data Flow
1. SonarX raw ingestion (snapshots/trades/metadata) into raw tables.
2. Aggregation worker builds canonical candle buckets.
3. Validation job compares SonarX buckets vs current provider for overlap windows.
4. API layer can serve either provider based on explicit option.
5. Client logic remains unchanged; optional provider telemetry can be surfaced for diagnostics.

## Failure Modes
- Incomplete bucket: mark candle `quality='partial'`, do not silently overwrite full buckets.
- Stream outage: pause provider reads or fallback to current provider.
- Mapping errors: reject rows that fail symbol/timeframe normalization.
- Divergence beyond threshold: trigger alert and keep current provider default.

## Acceptance Tests
1. Same request (`coin`, `timeframe`, `window`) returns stable ordering and no duplicates.
2. Aggregator produces deterministic candles for replayed raw input.
3. Provider routing in API returns expected dataset source.
4. Existing logic tests remain green with default provider unchanged.

## Rollout
1. Implement schema + ingestion in shadow mode.
2. Implement provider routing in API behind default `current`.
3. Run parity report window.
4. Perform canary switch per asset/timeframe only if parity gate passes.

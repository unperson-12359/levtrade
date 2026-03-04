# SonarX Feasibility Review (Hyperliquid + Step Pipeline Inputs)

Date: 2026-03-04

## Executive Verdict
SonarX is not a drop-in "free OHLC crypto historical prices API" in the same style as candle-first market data APIs.

Based on SonarX docs and public pages, their Hyperliquid offering is organized around market datasets (including L2 snapshots and trades), real-time streaming, and historical access. That can support our pipeline, but only after we add an ingestion + transformation layer to derive the exact candle and indicator inputs we currently consume directly.

## What SonarX Appears To Provide
- Hyperliquid dataset catalog in docs, including:
  - `public-l2-snapshots`
  - `public-l2-trades`
  - `public-market-metadata`
- Product features around:
  - real-time streaming
  - historical data access
  - data portals
- Public data page states the data products are currently free in beta.

## Direct Answer To Product Question
Question: "Is this like a free API of crypto historical prices?"

Answer: Not exactly.
- It is a free-in-beta data platform with Hyperliquid datasets.
- It is not positioned as a simple candle-only API endpoint.
- We should treat it as raw/structured market data that may require deriving OHLCV and indicator-ready series.

## Fit Against Our Current Inputs
Our current signal path uses hourly candles and derived indicators. SonarX can likely be used as an upstream source for this, but not as a zero-change replacement.

Expected integration work:
1. Ingest SonarX raw datasets (stream and/or history).
2. Aggregate to canonical candles (1m/5m/1h as needed).
3. Validate derived candles versus current source before cutover.
4. Feed existing signal calculators unchanged.

## Risks
- Schema/transport mismatch versus existing candle fetchers.
- Backfill and replay complexity for historical parity.
- Higher operational complexity (storage, jobs, quality checks).

## Recommended Adoption Strategy
- Keep current production source active.
- Build SonarX adapter in shadow mode.
- Compare candle and signal outputs for an evaluation window.
- Only switch production reads after parity thresholds are met.

## Sources
- https://docs.sonarx.com/
- https://docs.sonarx.com/datasets/HYPERLIQUID/public-l2-snapshots
- https://docs.sonarx.com/datasets/HYPERLIQUID/public-l2-trades
- https://docs.sonarx.com/datasets/HYPERLIQUID/public-market-metadata
- https://docs.sonarx.com/sitemap.xml
- https://sonarx.com/data

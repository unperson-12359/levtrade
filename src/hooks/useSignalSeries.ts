import { useMemo } from 'react'
import type { UTCTimestamp } from 'lightweight-charts'
import { computeEntryGeometry, computeHurst, computeZScore } from '../signals'
import { computeATR } from '../signals/volatility'
import { useStore } from '../store'
import type { TrackedCoin } from '../types/market'
import type { SignalSeriesKind } from '../utils/provenance'

export type SignalSeriesPoint = { time: UTCTimestamp; value: number }

interface SignalSeriesResult {
  series: SignalSeriesPoint[]
  currentValue: number | null
  label: string
  unit: string
  source: string
  lastRefreshedAt: number | null
  freshness: 'fresh' | 'stale' | 'warming-up' | 'missing'
}

export function useSignalSeries(coin: TrackedCoin, kind: SignalSeriesKind): SignalSeriesResult {
  const candles = useStore((s) => s.candles[coin])
  const fundingHistory = useStore((s) => s.fundingHistory[coin])
  const signals = useStore((s) => s.signals[coin])
  const lastRefreshedAt = signals?.updatedAt ?? null
  const freshness = !signals
    ? 'missing'
    : signals.isWarmingUp
      ? 'warming-up'
      : signals.isStale
        ? 'stale'
        : 'fresh'

  return useMemo(
    () => computeSignalSeries(kind, candles ?? [], fundingHistory ?? [], lastRefreshedAt, freshness),
    [candles, fundingHistory, freshness, kind, lastRefreshedAt],
  )
}

function computeSignalSeries(
  kind: SignalSeriesKind,
  candles: ReturnType<typeof useStore.getState>['candles'][TrackedCoin],
  fundingHistory: ReturnType<typeof useStore.getState>['fundingHistory'][TrackedCoin],
  lastRefreshedAt: number | null,
  freshness: SignalSeriesResult['freshness'],
): SignalSeriesResult {
  switch (kind) {
    case 'zScore':
      return buildZScoreSeries(candles, lastRefreshedAt, freshness)
    case 'hurst':
      return buildHurstSeries(candles, lastRefreshedAt, freshness)
    case 'atr':
      return buildAtrSeries(candles, lastRefreshedAt, freshness)
    case 'fundingRate':
      return buildFundingSeries(fundingHistory, lastRefreshedAt, freshness)
    case 'distanceFromMean':
      return buildEntryGeometrySeries(candles, 'distanceFromMean', lastRefreshedAt, freshness)
    case 'stretchZ':
      return buildEntryGeometrySeries(candles, 'stretchZ', lastRefreshedAt, freshness)
  }
}

function buildZScoreSeries(
  candles: ReturnType<typeof useStore.getState>['candles'][TrackedCoin],
  lastRefreshedAt: number | null,
  freshness: SignalSeriesResult['freshness'],
): SignalSeriesResult {
  const closes = candles.map((candle) => candle.close)
  const series: SignalSeriesPoint[] = []

  for (let index = 19; index < closes.length; index++) {
    const result = computeZScore(closes.slice(0, index + 1), 20)
    series.push({
      time: Math.floor(candles[index]!.time / 1000) as UTCTimestamp,
      value: result.value,
    })
  }

  return finalizeSeries(series, {
    label: 'Price Z-Score',
    unit: 'σ',
    source: '20-period rolling z-score of hourly closes. Data: Hyperliquid candleSnapshot API.',
    lastRefreshedAt,
    freshness,
  })
}

function buildHurstSeries(
  candles: ReturnType<typeof useStore.getState>['candles'][TrackedCoin],
  lastRefreshedAt: number | null,
  freshness: SignalSeriesResult['freshness'],
): SignalSeriesResult {
  const closes = candles.map((candle) => candle.close)
  const series: SignalSeriesPoint[] = []

  for (let index = 99; index < closes.length; index++) {
    const result = computeHurst(closes.slice(0, index + 1), 100)
    series.push({
      time: Math.floor(candles[index]!.time / 1000) as UTCTimestamp,
      value: result.value,
    })
  }

  return finalizeSeries(series, {
    label: 'Hurst Exponent',
    unit: '',
    source: '100-period ACF(1) Hurst approximation. Data: Hyperliquid candleSnapshot API.',
    lastRefreshedAt,
    freshness,
  })
}

function buildAtrSeries(
  candles: ReturnType<typeof useStore.getState>['candles'][TrackedCoin],
  lastRefreshedAt: number | null,
  freshness: SignalSeriesResult['freshness'],
): SignalSeriesResult {
  const series: SignalSeriesPoint[] = []

  for (let index = 13; index < candles.length; index++) {
    const atr = computeATR(candles.slice(0, index + 1), 14)
    series.push({
      time: Math.floor(candles[index]!.time / 1000) as UTCTimestamp,
      value: atr,
    })
  }

  return finalizeSeries(series, {
    label: 'ATR (14)',
    unit: '$',
    source: '14-period ATR from hourly OHLC. Data: Hyperliquid candleSnapshot API.',
    lastRefreshedAt,
    freshness,
  })
}

function buildFundingSeries(
  fundingHistory: ReturnType<typeof useStore.getState>['fundingHistory'][TrackedCoin],
  lastRefreshedAt: number | null,
  freshness: SignalSeriesResult['freshness'],
): SignalSeriesResult {
  const series = fundingHistory.map((item) => ({
    time: Math.floor(item.time / 1000) as UTCTimestamp,
    value: item.rate * 100,
  }))

  return finalizeSeries(series, {
    label: 'Funding Rate',
    unit: '%',
    source: 'Hourly funding snapshots. Data: Hyperliquid fundingHistory API.',
    lastRefreshedAt,
    freshness,
  })
}

function buildEntryGeometrySeries(
  candles: ReturnType<typeof useStore.getState>['candles'][TrackedCoin],
  kind: 'distanceFromMean' | 'stretchZ',
  lastRefreshedAt: number | null,
  freshness: SignalSeriesResult['freshness'],
): SignalSeriesResult {
  const closes = candles.map((candle) => candle.close)
  const series: SignalSeriesPoint[] = []

  for (let index = 19; index < closes.length; index++) {
    const atr = computeATR(candles.slice(0, index + 1), 14)
    const result = computeEntryGeometry(closes.slice(0, index + 1), atr, 20)
    series.push({
      time: Math.floor(candles[index]!.time / 1000) as UTCTimestamp,
      value: kind === 'distanceFromMean' ? result.distanceFromMeanPct : result.stretchZEquivalent,
    })
  }

  return finalizeSeries(series, {
    label: kind === 'distanceFromMean' ? 'Distance from Mean' : 'Stretch Z',
    unit: kind === 'distanceFromMean' ? '%' : 'σ',
    source:
      kind === 'distanceFromMean'
        ? '20-period SMA distance. Data: Hyperliquid candleSnapshot API.'
        : 'Entry geometry stretch z-score. Data: Hyperliquid candleSnapshot API.',
    lastRefreshedAt,
    freshness,
  })
}

function finalizeSeries(
  series: SignalSeriesPoint[],
  meta: Omit<SignalSeriesResult, 'series' | 'currentValue'>,
): SignalSeriesResult {
  return {
    ...meta,
    series,
    currentValue: series.length > 0 ? series[series.length - 1]!.value : null,
  }
}

// Type declarations for pre-bundled _signals.mjs (generated from src/signals/api-entry.ts)

import type { Candle, RawCandle, TrackedCoin } from '../src/types/market'
import type { PersistedObservatoryAnalytics } from '../src/observatory/analytics'
import type { IndicatorStateRecord, ObservatorySnapshot } from '../src/observatory/types'
import type { PriceContext } from '../src/observatory/priceContext'

export type { Candle, RawCandle, TrackedCoin } from '../src/types/market'
export const TRACKED_COINS: readonly TrackedCoin[]
export const OBSERVATORY_RULESET_VERSION: string
export function parseCandle(raw: RawCandle): Candle
export function buildPriceContext(input: {
  candles: Array<{ time: number; close: number }>
  interval: '1d'
  livePrice: number | null
  livePriceObservedAtMs?: number | null
  generatedAtMs?: number
}): PriceContext

export function buildObservatorySnapshot(input: {
  coin: TrackedCoin
  interval: '1d'
  candles: Candle[]
}): ObservatorySnapshot

export function buildPersistedObservatoryAnalytics(input: {
  coin: TrackedCoin
  interval: '1d'
  days: number
  rows: Array<{
    candleTime: number
    indicatorId: string
    category: ObservatorySnapshot['indicators'][number]['category']
    isOn: boolean
  }>
}): PersistedObservatoryAnalytics

export function buildIndicatorStateRecords(snapshot: ObservatorySnapshot): IndicatorStateRecord[]
export function getClosedBarTimes(snapshot: ObservatorySnapshot, now?: number): number[]
export function buildClosedIndicatorStateRecords(
  snapshot: ObservatorySnapshot,
  options?: { now?: number },
): IndicatorStateRecord[]

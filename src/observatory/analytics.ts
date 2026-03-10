import type { TrackedCoin } from '../types/market'
import type { IndicatorCategory, ObservatorySnapshot } from './types'

export const ANALYTICS_CATEGORY_ORDER: IndicatorCategory[] = ['Trend', 'Momentum', 'Volatility', 'Volume', 'Structure']

interface AnalyticsBooleanLedgerRow {
  candleTime: number
  indicatorId: string
  category: IndicatorCategory
  isOn: boolean
}

export interface PersistedAnalyticsRow {
  indicatorId: string
  category: IndicatorCategory
  activeBars: number
  activeRate: number
  transitionRate: number
  currentStreak: number
  maxStreak: number
  lastHitTime: number | null
  recentHitTimes: number[]
}

export interface PersistedAnalyticsCategoryRow {
  category: IndicatorCategory
  totalHits: number
  activeRate: number
}

export interface PersistedObservatoryAnalytics {
  coin: TrackedCoin
  interval: '4h' | '1d'
  days: number
  windowBars: number
  totalHits: number
  lastPersistedBarTime: number | null
  rows: PersistedAnalyticsRow[]
  categoryRows: PersistedAnalyticsCategoryRow[]
}

export function buildPersistedObservatoryAnalytics(input: {
  coin: TrackedCoin
  interval: '4h' | '1d'
  days: number
  rows: AnalyticsBooleanLedgerRow[]
}): PersistedObservatoryAnalytics {
  const barsByTime = new Map<number, Map<string, { category: IndicatorCategory; isOn: boolean }>>()
  const indicatorOrder: string[] = []
  const seenIndicators = new Set<string>()
  const categoryByIndicator = new Map<string, IndicatorCategory>()

  for (const row of input.rows) {
    let bar = barsByTime.get(row.candleTime)
    if (!bar) {
      bar = new Map()
      barsByTime.set(row.candleTime, bar)
    }
    bar.set(row.indicatorId, { category: row.category, isOn: row.isOn })

    if (!seenIndicators.has(row.indicatorId)) {
      seenIndicators.add(row.indicatorId)
      indicatorOrder.push(row.indicatorId)
      categoryByIndicator.set(row.indicatorId, row.category)
    }
  }

  const times = [...barsByTime.keys()].sort((left, right) => left - right)
  const rows = indicatorOrder.map<PersistedAnalyticsRow>((indicatorId) => ({
    indicatorId,
    category: categoryByIndicator.get(indicatorId) ?? 'Trend',
    activeBars: 0,
    activeRate: 0,
    transitionRate: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastHitTime: null,
    recentHitTimes: [],
  }))

  const rowByIndicator = new Map(rows.map((row) => [row.indicatorId, row]))
  const liveStreaks = new Map<string, number>(indicatorOrder.map((indicatorId) => [indicatorId, 0]))
  const categoryTotalHits = new Map<IndicatorCategory, number>(ANALYTICS_CATEGORY_ORDER.map((category) => [category, 0]))
  const categoryActiveBars = new Map<IndicatorCategory, number>(ANALYTICS_CATEGORY_ORDER.map((category) => [category, 0]))

  for (const time of times) {
    const bar = barsByTime.get(time)
    if (!bar) continue

    const barLaneCounts = new Map<IndicatorCategory, number>()
    for (const indicatorId of indicatorOrder) {
      const state = bar.get(indicatorId)
      const row = rowByIndicator.get(indicatorId)
      if (!row) continue

      const isOn = state?.isOn ?? false
      if (isOn) {
        row.activeBars += 1
        row.lastHitTime = time
        row.recentHitTimes.push(time)
        const nextStreak = (liveStreaks.get(indicatorId) ?? 0) + 1
        liveStreaks.set(indicatorId, nextStreak)
        row.maxStreak = Math.max(row.maxStreak, nextStreak)
        barLaneCounts.set(row.category, (barLaneCounts.get(row.category) ?? 0) + 1)
      } else {
        liveStreaks.set(indicatorId, 0)
      }
    }

    for (const category of ANALYTICS_CATEGORY_ORDER) {
      const laneCount = barLaneCounts.get(category) ?? 0
      categoryTotalHits.set(category, (categoryTotalHits.get(category) ?? 0) + laneCount)
      if (laneCount > 0) {
        categoryActiveBars.set(category, (categoryActiveBars.get(category) ?? 0) + 1)
      }
    }
  }

  const windowBars = Math.max(times.length, 1)
  for (const row of rows) {
    row.activeRate = row.activeBars / windowBars
    const states = times.map((time) => barsByTime.get(time)?.get(row.indicatorId)?.isOn ?? false)
    let transitions = 0
    for (let index = 1; index < states.length; index += 1) {
      if (states[index] !== states[index - 1]) {
        transitions += 1
      }
    }
    row.transitionRate = transitions / Math.max(states.length - 1, 1)
    row.currentStreak = liveStreaks.get(row.indicatorId) ?? 0
    row.recentHitTimes = row.recentHitTimes.slice(-4).reverse()
  }

  rows.sort((left, right) => right.activeBars - left.activeBars || right.activeRate - left.activeRate || right.maxStreak - left.maxStreak)

  return {
    coin: input.coin,
    interval: input.interval,
    days: input.days,
    windowBars: times.length,
    totalHits: rows.reduce((sum, row) => sum + row.activeBars, 0),
    lastPersistedBarTime: times[times.length - 1] ?? null,
    rows,
    categoryRows: ANALYTICS_CATEGORY_ORDER.map((category) => ({
      category,
      totalHits: categoryTotalHits.get(category) ?? 0,
      activeRate: (categoryActiveBars.get(category) ?? 0) / windowBars,
    })).sort((left, right) => right.totalHits - left.totalHits),
  }
}

export function buildSnapshotAnalytics(snapshot: ObservatorySnapshot): PersistedObservatoryAnalytics {
  const interval = snapshot.interval === '1d' ? '1d' : '4h'
  const rows = snapshot.barStates.flatMap((barState) => {
    const activeIds = new Set(barState.activeIndicatorIds)
    return snapshot.indicators.map((indicator) => ({
      candleTime: barState.time,
      indicatorId: indicator.id,
      category: indicator.category,
      isOn: activeIds.has(indicator.id),
    }))
  })

  return buildPersistedObservatoryAnalytics({
    coin: snapshot.coin,
    interval,
    days: 0,
    rows,
  })
}

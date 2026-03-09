import { useMemo, useState } from 'react'
import type { IndicatorCategory, ObservatorySnapshot } from '../../observatory/types'
import type { TrackedCoin } from '../../types/market'

const CATEGORY_ORDER: IndicatorCategory[] = ['Trend', 'Momentum', 'Volatility', 'Volume', 'Flow', 'Structure']

type AnalyticsSortKey = 'hits' | 'activeRate' | 'currentStreak' | 'maxStreak'
type CategoryFilter = IndicatorCategory | 'All'

interface AnalyticsPageProps {
  coin: TrackedCoin
  timeframe: '4h' | '1d'
  snapshot: ObservatorySnapshot
}

interface IndicatorAnalyticsRow {
  id: string
  label: string
  category: IndicatorCategory
  state: string
  totalHits: number
  activeBars: number
  activeRate: number
  currentStreak: number
  maxStreak: number
  lastHitTime: number | null
}

export function AnalyticsPage({ coin, timeframe, snapshot }: AnalyticsPageProps) {
  const [sortKey, setSortKey] = useState<AnalyticsSortKey>('hits')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All')

  const analytics = useMemo(() => buildAnalytics(snapshot), [snapshot])

  const visibleRows = useMemo(() => {
    const filtered = categoryFilter === 'All'
      ? analytics.rows
      : analytics.rows.filter((row) => row.category === categoryFilter)

    return filtered.slice().sort((a, b) => compareRows(a, b, sortKey))
  }, [analytics.rows, categoryFilter, sortKey])

  const summaryCards = useMemo(() => {
    const hottest = analytics.rows[0] ?? null
    const liveStreak = analytics.rows.slice().sort((a, b) => b.currentStreak - a.currentStreak || b.totalHits - a.totalHits)[0] ?? null

    return [
      {
        label: 'Window',
        value: `${snapshot.timeline.length} bars`,
        meta: `${coin} / ${timeframe}`,
      },
      {
        label: 'Total hits',
        value: formatInteger(analytics.totalHits),
        meta: 'All indicator events',
      },
      {
        label: 'Most active',
        value: hottest ? hottest.label : '--',
        meta: hottest ? `${hottest.totalHits} hits` : 'No events',
      },
      {
        label: 'Live streak',
        value: liveStreak ? liveStreak.label : '--',
        meta: liveStreak ? `${liveStreak.currentStreak} bars` : 'No live streak',
      },
    ]
  }, [analytics.rows, analytics.totalHits, coin, snapshot.timeline.length, timeframe])

  return (
    <section className="obs-analytics" data-testid="obs-analytics-page">
      <div className="obs-panel obs-panel--analytics-hero">
        <div className="obs-panel__title-row">
          <div>
            <div className="obs-panel__eyebrow">Indicator analytics</div>
            <h2 className="obs-panel__title">Frequency and streak engine</h2>
          </div>
          <p className="obs-panel__hint">Ranking indicators by appearance rate, persistence, and recent activity.</p>
        </div>

        <div className="obs-analytics__summary">
          {summaryCards.map((card) => (
            <div key={card.label} className="obs-analytics__card">
              <span className="obs-analytics__card-label">{card.label}</span>
              <strong className="obs-analytics__card-value">{card.value}</strong>
              <span className="obs-analytics__card-meta">{card.meta}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="obs-analytics__layout">
        <section className="obs-panel obs-panel--analytics-table">
          <div className="obs-panel__title-row">
            <div>
              <div className="obs-panel__eyebrow">Leaderboard</div>
              <h2 className="obs-panel__title">Indicator frequency</h2>
            </div>
            <div className="obs-panel__title-actions">
              {(['hits', 'activeRate', 'currentStreak', 'maxStreak'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`obs-chip obs-chip--nav ${sortKey === option ? 'obs-chip--active' : ''}`}
                  onClick={() => setSortKey(option)}
                  data-testid={`obs-analytics-sort-${option}`}
                >
                  {sortLabel(option)}
                </button>
              ))}
            </div>
          </div>

          <div className="obs-analytics__filters">
            {(['All', ...CATEGORY_ORDER] as const).map((category) => (
              <button
                key={category}
                type="button"
                className={`obs-chip obs-chip--nav ${categoryFilter === category ? 'obs-chip--active' : ''}`}
                onClick={() => setCategoryFilter(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="obs-analytics__table" data-testid="obs-analytics-table">
            <div className="obs-analytics__row obs-analytics__row--head">
              <span>Indicator</span>
              <span>Hits</span>
              <span>Active rate</span>
              <span>Current</span>
              <span>Max</span>
              <span>Last hit</span>
            </div>
            {visibleRows.map((row) => (
              <div key={row.id} className="obs-analytics__row" data-testid="obs-analytics-indicator-row">
                <div className="obs-analytics__indicator">
                  <span className="obs-analytics__indicator-name">{row.label}</span>
                  <span className="obs-analytics__indicator-meta">{row.category} / {row.state}</span>
                </div>
                <span>{formatInteger(row.totalHits)}</span>
                <span>{formatPct(row.activeRate)}</span>
                <span>{row.currentStreak} bars</span>
                <span>{row.maxStreak} bars</span>
                <span>{row.lastHitTime ? formatCompactTime(row.lastHitTime) : '--'}</span>
              </div>
            ))}
          </div>
        </section>

        <aside className="obs-analytics__rail">
          <section className="obs-panel">
            <div className="obs-panel__eyebrow">Category totals</div>
            <h2 className="obs-panel__title">Where signals cluster</h2>
            <div className="obs-pulse-list">
              {analytics.categoryRows.map((row) => (
                <div key={row.category} className="obs-pulse-row">
                  <span>{row.category}</span>
                  <span>{row.totalHits} hits / {formatPct(row.activeRate)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="obs-panel">
            <div className="obs-panel__eyebrow">Streak leaders</div>
            <h2 className="obs-panel__title">Persistent signals</h2>
            <div className="obs-pulse-list">
              {analytics.rows
                .slice()
                .sort((a, b) => b.currentStreak - a.currentStreak || b.maxStreak - a.maxStreak || b.totalHits - a.totalHits)
                .slice(0, 6)
                .map((row) => (
                  <div key={row.id} className="obs-pulse-row obs-pulse-row--stacked">
                    <span>{row.label}</span>
                    <span>{row.currentStreak} live / {row.maxStreak} max</span>
                  </div>
                ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  )
}

function buildAnalytics(snapshot: ObservatorySnapshot) {
  const rows = snapshot.indicators.map<IndicatorAnalyticsRow>((indicator) => ({
    id: indicator.id,
    label: indicator.label,
    category: indicator.category,
    state: indicator.currentState,
    totalHits: 0,
    activeBars: 0,
    activeRate: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastHitTime: null,
  }))

  const categoryActiveBars = new Map<IndicatorCategory, number>(CATEGORY_ORDER.map((category) => [category, 0]))
  const categoryTotalHits = new Map<IndicatorCategory, number>(CATEGORY_ORDER.map((category) => [category, 0]))

  for (const cluster of snapshot.timeline) {
    const perIndicatorCounts = new Map<string, number>()
    const activeCategories = new Set<IndicatorCategory>()

    for (const event of cluster.events) {
      perIndicatorCounts.set(event.indicatorId, (perIndicatorCounts.get(event.indicatorId) ?? 0) + 1)
      categoryTotalHits.set(event.category, (categoryTotalHits.get(event.category) ?? 0) + 1)
      activeCategories.add(event.category)
    }

    for (const category of activeCategories) {
      categoryActiveBars.set(category, (categoryActiveBars.get(category) ?? 0) + 1)
    }

    for (const row of rows) {
      const count = perIndicatorCounts.get(row.id) ?? 0
      if (count > 0) {
        row.totalHits += count
        row.activeBars += 1
        row.currentStreak += 1
        row.maxStreak = Math.max(row.maxStreak, row.currentStreak)
        row.lastHitTime = cluster.time
      } else {
        row.currentStreak = 0
      }
    }
  }

  const timelineCount = Math.max(snapshot.timeline.length, 1)
  for (const row of rows) {
    row.activeRate = row.activeBars / timelineCount
  }

  rows.sort((a, b) => b.totalHits - a.totalHits || b.activeRate - a.activeRate || b.maxStreak - a.maxStreak)

  const categoryRows = CATEGORY_ORDER.map((category) => ({
    category,
    totalHits: categoryTotalHits.get(category) ?? 0,
    activeRate: (categoryActiveBars.get(category) ?? 0) / timelineCount,
  })).sort((a, b) => b.totalHits - a.totalHits)

  return {
    rows,
    totalHits: rows.reduce((sum, row) => sum + row.totalHits, 0),
    categoryRows,
  }
}

function compareRows(a: IndicatorAnalyticsRow, b: IndicatorAnalyticsRow, sortKey: AnalyticsSortKey) {
  switch (sortKey) {
    case 'activeRate':
      return b.activeRate - a.activeRate || b.totalHits - a.totalHits
    case 'currentStreak':
      return b.currentStreak - a.currentStreak || b.totalHits - a.totalHits
    case 'maxStreak':
      return b.maxStreak - a.maxStreak || b.totalHits - a.totalHits
    case 'hits':
    default:
      return b.totalHits - a.totalHits || b.activeRate - a.activeRate
  }
}

function sortLabel(value: AnalyticsSortKey) {
  switch (value) {
    case 'activeRate':
      return 'Active rate'
    case 'currentStreak':
      return 'Live streak'
    case 'maxStreak':
      return 'Max streak'
    case 'hits':
    default:
      return 'Hits'
  }
}

function formatPct(value: number) {
  if (!Number.isFinite(value)) return '--'
  return `${(value * 100).toFixed(0)}%`
}

function formatInteger(value: number) {
  if (!Number.isFinite(value)) return '--'
  return value.toLocaleString()
}

function formatCompactTime(value: number) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

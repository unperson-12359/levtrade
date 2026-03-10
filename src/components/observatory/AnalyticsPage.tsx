import { useMemo, useState } from 'react'
import type { IndicatorCategory, ObservatorySnapshot } from '../../observatory/types'
import type { TrackedCoin } from '../../types/market'

const CATEGORY_ORDER: IndicatorCategory[] = ['Trend', 'Momentum', 'Volatility', 'Volume', 'Structure']

type AnalyticsSortKey = 'activeBars' | 'activeRate' | 'currentStreak' | 'maxStreak'
type CategoryFilter = IndicatorCategory | 'All'

interface AnalyticsPageProps {
  coin: TrackedCoin
  timeframe: '4h' | '1d'
  snapshot: ObservatorySnapshot
}

interface IndicatorAnalyticsRow {
  id: string
  label: string
  description: string
  category: IndicatorCategory
  state: string
  unit: string
  currentValue: number | null
  quantileBucket: string | null
  totalHits: number
  activeBars: number
  activeRate: number
  currentStreak: number
  maxStreak: number
  lastHitTime: number | null
  recentHitTimes: number[]
  transitionRate: number
}

export function AnalyticsPage({ coin, timeframe, snapshot }: AnalyticsPageProps) {
  const [sortKey, setSortKey] = useState<AnalyticsSortKey>('activeBars')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All')
  const [selectedIndicatorId, setSelectedIndicatorId] = useState<string | null>(null)

  const analytics = useMemo(() => buildAnalytics(snapshot), [snapshot])

  const visibleRows = useMemo(() => {
    const filtered = categoryFilter === 'All'
      ? analytics.rows
      : analytics.rows.filter((row) => row.category === categoryFilter)

    return filtered.slice().sort((a, b) => compareRows(a, b, sortKey))
  }, [analytics.rows, categoryFilter, sortKey])

  const selectedIndicator = useMemo(
    () => visibleRows.find((row) => row.id === selectedIndicatorId) ?? analytics.rows.find((row) => row.id === selectedIndicatorId) ?? visibleRows[0] ?? analytics.rows[0] ?? null,
    [analytics.rows, selectedIndicatorId, visibleRows],
  )

  const summaryCards = useMemo(() => {
    const hottest = analytics.rows[0] ?? null
    const liveStreak = analytics.rows.slice().sort((a, b) => b.currentStreak - a.currentStreak || b.totalHits - a.totalHits)[0] ?? null

    return [
      {
        label: 'Window',
        value: `${snapshot.barStates.length} bars`,
        meta: `${coin} / ${timeframe}`,
      },
      {
        label: 'Active states',
        value: formatInteger(analytics.totalHits),
        meta: 'All indicator-on bars',
      },
      {
        label: 'Most persistent',
        value: hottest ? hottest.label : '--',
        meta: hottest ? `${hottest.totalHits} active bars` : 'No active states',
      },
      {
        label: 'Live streak',
        value: liveStreak ? liveStreak.label : '--',
        meta: liveStreak ? `${liveStreak.currentStreak} bars` : 'No live streak',
      },
    ]
  }, [analytics.rows, analytics.totalHits, coin, snapshot.barStates.length, timeframe])

  return (
    <section className="obs-analytics" data-testid="obs-analytics-page">
      <div className="obs-panel obs-panel--analytics-hero">
        <div className="obs-panel__title-row">
          <div>
            <div className="obs-panel__eyebrow">Indicator analytics</div>
            <h2 className="obs-panel__title">Persistence and streak engine</h2>
          </div>
          <p className="obs-panel__hint">Use this after the live read. It explains persistence and recurrence; it is not the first page to interpret the market.</p>
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
              <h2 className="obs-panel__title">Indicator persistence</h2>
            </div>
            <div className="obs-panel__title-actions">
              {(['activeBars', 'activeRate', 'currentStreak', 'maxStreak'] as const).map((option) => (
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
              <span>Active bars</span>
              <span>Active rate</span>
              <span>Current</span>
              <span>Max</span>
              <span>Last active</span>
            </div>
            {visibleRows.map((row) => (
              <button
                key={row.id}
                type="button"
                className={`obs-analytics__row ${selectedIndicator?.id === row.id ? 'obs-analytics__row--active' : ''}`}
                data-testid="obs-analytics-indicator-row"
                onClick={() => setSelectedIndicatorId(row.id)}
              >
                <div className="obs-analytics__indicator">
                  <span className="obs-analytics__indicator-name">{row.label}</span>
                  <span className="obs-analytics__indicator-meta">{row.category} / {row.state}</span>
                </div>
                <span>{formatInteger(row.totalHits)}</span>
                <span>{formatPct(row.activeRate)}</span>
                <span>{row.currentStreak} bars</span>
                <span>{row.maxStreak} bars</span>
                <span>{row.lastHitTime ? formatCompactTime(row.lastHitTime) : '--'}</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="obs-analytics__rail">
          <section className="obs-panel" data-testid="obs-analytics-inspector">
            <div className="obs-panel__eyebrow">Inspector</div>
            <h2 className="obs-panel__title">{selectedIndicator?.label ?? 'No indicator selected'}</h2>
            {selectedIndicator ? (
              <>
                <div className="obs-selected-cluster__metrics">
                  <div className="obs-detail-kv"><span>Current</span><span>{formatValue(selectedIndicator.currentValue, selectedIndicator.unit)}</span></div>
                  <div className="obs-detail-kv"><span>State</span><span>{selectedIndicator.state}</span></div>
                  <div className="obs-detail-kv"><span>Quantile</span><span>{selectedIndicator.quantileBucket ?? '--'}</span></div>
                  <div className="obs-detail-kv"><span>Transitions</span><span>{formatPct(selectedIndicator.transitionRate)}</span></div>
                </div>
                <p className="obs-detail-copy">{selectedIndicator.description}</p>
                <div className="obs-detail-subtitle">Recent active bars</div>
                <div className="obs-pulse-list">
                  {selectedIndicator.recentHitTimes.length > 0 ? (
                    selectedIndicator.recentHitTimes.slice(0, 4).map((time) => (
                      <div key={time} className="obs-pulse-row">
                        <span>{formatCompactTime(time)}</span>
                        <span>{timeframe}</span>
                      </div>
                    ))
                  ) : (
                    <div className="obs-empty">No active bars in the visible window.</div>
                  )}
                </div>
              </>
            ) : null}
          </section>

          <section className="obs-panel">
            <div className="obs-panel__eyebrow">Category totals</div>
            <h2 className="obs-panel__title">Where signals cluster</h2>
            <div className="obs-pulse-list">
              {analytics.categoryRows.map((row) => (
                <div key={row.category} className="obs-pulse-row">
                  <span>{row.category}</span>
                  <span>{row.totalHits} active states / {formatPct(row.activeRate)}</span>
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
    description: indicator.description,
    category: indicator.category,
    state: indicator.currentState,
    unit: indicator.unit,
    currentValue: indicator.currentValue,
    quantileBucket: indicator.quantileBucket,
    totalHits: 0,
    activeBars: 0,
    activeRate: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastHitTime: null,
    recentHitTimes: [],
    transitionRate: indicator.frequency.stateTransitionRate,
  }))

  const categoryActiveBars = new Map<IndicatorCategory, number>(CATEGORY_ORDER.map((category) => [category, 0]))
  const categoryTotalHits = new Map<IndicatorCategory, number>(CATEGORY_ORDER.map((category) => [category, 0]))

  for (const barState of snapshot.barStates) {
    const activeIndicators = new Set(barState.activeIndicatorIds)
    for (const row of rows) {
      if (activeIndicators.has(row.id)) {
        row.totalHits += 1
        row.activeBars += 1
        row.currentStreak += 1
        row.maxStreak = Math.max(row.maxStreak, row.currentStreak)
        row.lastHitTime = barState.time
        row.recentHitTimes.push(barState.time)
      } else {
        row.currentStreak = 0
      }
    }

    for (const category of CATEGORY_ORDER) {
      const laneCount = barState.laneCounts[category] ?? 0
      categoryTotalHits.set(category, (categoryTotalHits.get(category) ?? 0) + laneCount)
      if (laneCount > 0) {
        categoryActiveBars.set(category, (categoryActiveBars.get(category) ?? 0) + 1)
      }
    }
  }

  const timelineCount = Math.max(snapshot.barStates.length, 1)
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
    case 'activeBars':
      return b.totalHits - a.totalHits || b.activeRate - a.activeRate
    case 'activeRate':
      return b.activeRate - a.activeRate || b.totalHits - a.totalHits
    case 'currentStreak':
      return b.currentStreak - a.currentStreak || b.totalHits - a.totalHits
    case 'maxStreak':
      return b.maxStreak - a.maxStreak || b.totalHits - a.totalHits
    default:
      return b.totalHits - a.totalHits || b.activeRate - a.activeRate
  }
}

function sortLabel(value: AnalyticsSortKey) {
  switch (value) {
    case 'activeBars':
      return 'Active bars'
    case 'activeRate':
      return 'Active rate'
    case 'currentStreak':
      return 'Live streak'
    case 'maxStreak':
      return 'Max streak'
    default:
      return 'Active bars'
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

function formatValue(value: number | null, unit: string) {
  if (value === null || !Number.isFinite(value)) return '--'
  if (unit === '%') return `${value.toFixed(1)}%`
  if (unit === 'bp') return `${value.toFixed(1)}bp`
  return value.toFixed(2)
}

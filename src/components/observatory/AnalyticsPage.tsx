import { useEffect, useMemo, useState } from 'react'
import {
  ANALYTICS_CATEGORY_ORDER,
  buildSnapshotAnalytics,
  type PersistedAnalyticsCategoryRow,
  type PersistedObservatoryAnalytics,
} from '../../observatory/analytics'
import { formatPct, formatValue } from '../../observatory/format'
import { formatUtcDate } from '../../observatory/timeFormat'
import type { IndicatorCategory, ObservatorySnapshot } from '../../observatory/types'
import type { TrackedCoin } from '../../types/market'

type AnalyticsSortKey = 'activeBars' | 'activeRate' | 'currentStreak' | 'maxStreak'
type CategoryFilter = IndicatorCategory | 'All'
type AnalyticsSourceMode = 'ledger' | 'live-window'

interface AnalyticsPageProps {
  coin: TrackedCoin
  timeframe: '1d'
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

interface AnalyticsApiResponse {
  ok?: boolean
  analytics?: PersistedObservatoryAnalytics
  error?: string
}

const LEDGER_LOOKBACK_DAYS = 180

export function AnalyticsPage({ coin, timeframe, snapshot }: AnalyticsPageProps) {
  const [sortKey, setSortKey] = useState<AnalyticsSortKey>('activeBars')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All')
  const [selectedIndicatorId, setSelectedIndicatorId] = useState<string | null>(null)
  const [persistedAnalytics, setPersistedAnalytics] = useState<PersistedObservatoryAnalytics | null>(null)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [loadingPersisted, setLoadingPersisted] = useState(false)

  const fallbackAnalytics = useMemo(() => buildSnapshotAnalytics(snapshot), [snapshot])

  useEffect(() => {
    if (import.meta.env.VITE_E2E_MOCK === '1') {
      setPersistedAnalytics(null)
      setAnalyticsError(null)
      setLoadingPersisted(false)
      return
    }

    let active = true
    const controller = new AbortController()
    setPersistedAnalytics(null)

    const pull = async () => {
      setLoadingPersisted(true)
      setAnalyticsError(null)

      try {
        const params = new URLSearchParams({
          coin,
          interval: timeframe,
          days: String(LEDGER_LOOKBACK_DAYS),
        })
        const response = await fetch(`/api/observatory-analytics?${params.toString()}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const payload = (await response.json()) as AnalyticsApiResponse
        if (!active || payload.ok !== true || !payload.analytics) return

        setPersistedAnalytics(payload.analytics)
      } catch (error) {
        if (!active || controller.signal.aborted) return
        setPersistedAnalytics(null)
        setAnalyticsError(error instanceof Error ? error.message : 'Unable to load analytics ledger.')
      } finally {
        if (active) {
          setLoadingPersisted(false)
        }
      }
    }

    void pull()
    return () => {
      active = false
      controller.abort()
    }
  }, [coin, timeframe])

  const analytics = persistedAnalytics ?? fallbackAnalytics
  const sourceMode: AnalyticsSourceMode = persistedAnalytics ? 'ledger' : 'live-window'
  const analyticsRows = useMemo(() => mergeAnalyticsRows(snapshot, analytics), [analytics, snapshot])
  const categoryRows = useMemo(() => mergeCategoryRows(analytics.categoryRows), [analytics.categoryRows])

  const visibleRows = useMemo(() => {
    const filtered = categoryFilter === 'All'
      ? analyticsRows
      : analyticsRows.filter((row) => row.category === categoryFilter)

    return filtered.slice().sort((a, b) => compareRows(a, b, sortKey))
  }, [analyticsRows, categoryFilter, sortKey])

  const selectedIndicator = useMemo(
    () =>
      visibleRows.find((row) => row.id === selectedIndicatorId) ??
      analyticsRows.find((row) => row.id === selectedIndicatorId) ??
      visibleRows[0] ??
      analyticsRows[0] ??
      null,
    [analyticsRows, selectedIndicatorId, visibleRows],
  )

  const summaryCards = useMemo(() => {
    const hottest = analyticsRows[0] ?? null
    const liveStreak = analyticsRows
      .slice()
      .sort((a, b) => b.currentStreak - a.currentStreak || b.totalHits - a.totalHits)[0] ?? null

    return [
      {
        label: 'Window',
        value: sourceMode === 'ledger' ? `${analytics.days}d ledger` : `${analytics.windowBars} bars`,
        meta: `${analytics.windowBars} bars / ${coin} / ${timeframe}`,
      },
      {
        label: 'Active indicators',
        value: formatInteger(analytics.totalHits),
        meta: sourceMode === 'ledger' ? 'Persisted indicator-on bars' : 'Visible window indicator-on bars',
      },
      {
        label: 'Most persistent',
        value: hottest ? hottest.label : '--',
        meta: hottest ? `${hottest.totalHits} active bars` : 'No active states',
      },
      {
        label: 'Current streak',
        value: liveStreak ? liveStreak.label : '--',
        meta: liveStreak ? `${liveStreak.currentStreak} bars` : 'No current streak',
      },
    ]
  }, [analytics.days, analytics.totalHits, analytics.windowBars, analyticsRows, coin, sourceMode, timeframe])

  return (
    <section className="obs-analytics" data-testid="obs-analytics-page">
      <div className="obs-panel obs-panel--analytics-hero">
        <div className="obs-panel__title-row">
          <div>
            <div className="obs-panel__eyebrow">Indicator analytics</div>
            <h2 className="obs-panel__title">Persistence and streak engine</h2>
          </div>
          <p className="obs-panel__hint">Use this after the live read. It explains recurrence across the ledger, not just what is happening on the latest candle.</p>
        </div>

        <div className={`obs-analytics__source obs-analytics__source--${sourceMode}`} data-testid="obs-analytics-source">
          <strong>{sourceMode === 'ledger' ? `${analytics.days}d ledger` : 'Live window fallback'}</strong>
          <span>{buildSourceMeta(analytics, sourceMode, loadingPersisted, analyticsError)}</span>
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
            {(['All', ...ANALYTICS_CATEGORY_ORDER] as const).map((category) => (
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
              <span title="How many time periods this indicator was firing">Active bars</span>
              <span title="Percentage of bars where this indicator was active">Active rate</span>
              <span title="Consecutive bars currently active">Current streak</span>
              <span title="Longest consecutive active streak observed">Max streak</span>
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
                    <div className="obs-empty">No active bars in the selected analytics window.</div>
                  )}
                </div>
              </>
            ) : null}
          </section>

          <section className="obs-panel">
            <div className="obs-panel__eyebrow">Category totals</div>
            <h2 className="obs-panel__title">Where signals cluster</h2>
            <div className="obs-pulse-list">
              {categoryRows.map((row) => (
                <div key={row.category} className="obs-pulse-row">
                  <span>{row.category}</span>
                  <span>{row.totalHits} active indicators / {formatPct(row.activeRate)}</span>
                </div>
              ))}
            </div>
          </section>

        </aside>
      </div>
    </section>
  )
}

function mergeAnalyticsRows(snapshot: ObservatorySnapshot, analytics: PersistedObservatoryAnalytics): IndicatorAnalyticsRow[] {
  const persistedByIndicator = new Map(analytics.rows.map((row) => [row.indicatorId, row]))

  return snapshot.indicators.map<IndicatorAnalyticsRow>((indicator) => {
    const persisted = persistedByIndicator.get(indicator.id)
    return {
      id: indicator.id,
      label: indicator.label,
      description: indicator.description,
      category: indicator.category,
      state: indicator.currentState,
      unit: indicator.unit,
      currentValue: indicator.currentValue,
      quantileBucket: indicator.quantileBucket,
      totalHits: persisted?.activeBars ?? 0,
      activeBars: persisted?.activeBars ?? 0,
      activeRate: persisted?.activeRate ?? 0,
      currentStreak: persisted?.currentStreak ?? 0,
      maxStreak: persisted?.maxStreak ?? 0,
      lastHitTime: persisted?.lastHitTime ?? null,
      recentHitTimes: persisted?.recentHitTimes ?? [],
      transitionRate: persisted?.transitionRate ?? indicator.frequency.stateTransitionRate,
    }
  }).sort((left, right) => right.totalHits - left.totalHits || right.activeRate - left.activeRate || right.maxStreak - left.maxStreak)
}

function mergeCategoryRows(categoryRows: PersistedAnalyticsCategoryRow[]) {
  const byCategory = new Map(categoryRows.map((row) => [row.category, row]))
  return ANALYTICS_CATEGORY_ORDER.map((category) => ({
    category,
    totalHits: byCategory.get(category)?.totalHits ?? 0,
    activeRate: byCategory.get(category)?.activeRate ?? 0,
  })).sort((left, right) => right.totalHits - left.totalHits)
}

function buildSourceMeta(
  analytics: PersistedObservatoryAnalytics,
  sourceMode: AnalyticsSourceMode,
  loadingPersisted: boolean,
  analyticsError: string | null,
) {
  if (sourceMode === 'ledger') {
    const persistedTime = analytics.lastPersistedBarTime ? formatCompactTime(analytics.lastPersistedBarTime) : '--'
    return `${analytics.windowBars} bars loaded through ${persistedTime}.`
  }
  if (loadingPersisted) {
    return 'Showing the visible snapshot window while the ledger loads.'
  }
  if (analyticsError) {
    return `Ledger unavailable (${analyticsError}). Showing the visible snapshot window instead.`
  }
  return 'Showing the visible snapshot window instead of persisted history.'
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

function formatInteger(value: number) {
  if (!Number.isFinite(value)) return '--'
  return value.toLocaleString()
}

function formatCompactTime(value: number) {
  return formatUtcDate(value)
}

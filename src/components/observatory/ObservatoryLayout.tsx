import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDataManager } from '../../hooks/useDataManager'
import { useHashRouter } from '../../hooks/useHashRouter'
import { useIndicatorObservatory } from '../../hooks/useIndicatorObservatory'
import type { IndicatorCategory, IndicatorHealthStatus } from '../../observatory/types'
import { useStore } from '../../store'
import { TRACKED_COINS } from '../../types/market'
import { PriceChart } from '../chart/PriceChart'
import { IndicatorClusterLanes, type ClusterPresentationMode } from './IndicatorClusterLanes'
import { CandleReportPage } from './CandleReportPage'
import { PoolMap } from './PoolMap'

const CATEGORY_ORDER: IndicatorCategory[] = ['Trend', 'Momentum', 'Volatility', 'Volume', 'Flow', 'Structure']
const ALLOWED_INTERVALS = ['4h', '1d'] as const
type AllowedInterval = (typeof ALLOWED_INTERVALS)[number]
type ViewMode = 'basic' | 'advanced'
type PrimaryView = 'timeline' | 'network'

export function ObservatoryLayout() {
  useDataManager()

  const selectedCoin = useStore((state) => state.selectedCoin)
  const selectCoin = useStore((state) => state.selectCoin)
  const selectedInterval = useStore((state) => state.selectedInterval)
  const setInterval = useStore((state) => state.setInterval)
  const connectionStatus = useStore((state) => state.connectionStatus)
  const runtimeDiagnostics = useStore((state) => state.runtimeDiagnostics)
  const clearRuntimeDiagnostics = useStore((state) => state.clearRuntimeDiagnostics)
  const prices = useStore((state) => state.prices)

  const { route, navigateToHeatmap, navigateToReport } = useHashRouter()

  const { snapshot, priceContext, source, freshness, loading } = useIndicatorObservatory(selectedCoin)
  const [selectedIndicatorId, setSelectedIndicatorId] = useState<string | null>(null)
  const [selectedClusterTime, setSelectedClusterTime] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('basic')
  const [primaryView, setPrimaryView] = useState<PrimaryView>('timeline')
  const [clusterMode, setClusterMode] = useState<ClusterPresentationMode>('simple')
  const [showRuntimeDetail, setShowRuntimeDetail] = useState(false)
  const [showHealthDetail, setShowHealthDetail] = useState(false)
  const [chartCollapsed, setChartCollapsed] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(true)

  useEffect(() => {
    if (selectedInterval !== '4h' && selectedInterval !== '1d') {
      setInterval('4h')
    }
  }, [selectedInterval, setInterval])

  useEffect(() => {
    if (route.coin && route.coin !== selectedCoin) {
      selectCoin(route.coin)
    }
    if (route.interval && route.interval !== selectedInterval) {
      setInterval(route.interval)
    }
  }, [route.coin, route.interval, selectCoin, selectedCoin, selectedInterval, setInterval])

  useEffect(() => {
    if (snapshot.indicators.length === 0) {
      setSelectedIndicatorId(null)
      return
    }
    const exists = snapshot.indicators.some((indicator) => indicator.id === selectedIndicatorId)
    if (!exists) {
      setSelectedIndicatorId(snapshot.indicators[0]?.id ?? null)
    }
  }, [selectedIndicatorId, snapshot.indicators])

  useEffect(() => {
    if (route.page === 'report') return
    if (snapshot.timeline.length === 0) {
      setSelectedClusterTime(null)
      return
    }
    const exists = snapshot.timeline.some((cluster) => cluster.time === selectedClusterTime)
    if (!exists) {
      setSelectedClusterTime(snapshot.timeline[snapshot.timeline.length - 1]?.time ?? null)
    }
  }, [selectedClusterTime, snapshot.timeline, route.page])

  useEffect(() => {
    if (runtimeDiagnostics.length > 0) {
      setShowRuntimeDetail(true)
    }
  }, [runtimeDiagnostics.length])

  const selectedIndicator = useMemo(
    () => snapshot.indicators.find((indicator) => indicator.id === selectedIndicatorId) ?? null,
    [selectedIndicatorId, snapshot.indicators],
  )

  const indicatorsByCategory = useMemo(() => {
    const grouped: Record<IndicatorCategory, typeof snapshot.indicators> = {
      Trend: [],
      Momentum: [],
      Volatility: [],
      Volume: [],
      Flow: [],
      Structure: [],
    }
    for (const indicator of snapshot.indicators) {
      grouped[indicator.category].push(indicator)
    }
    return grouped
  }, [snapshot.indicators])

  const mapIndicators = useMemo(() => {
    if (viewMode === 'advanced') return snapshot.indicators
    const keep = new Set<string>()
    for (const category of CATEGORY_ORDER) {
      for (const indicator of indicatorsByCategory[category].slice(0, 4)) {
        keep.add(indicator.id)
      }
    }
    if (selectedIndicatorId) keep.add(selectedIndicatorId)
    return snapshot.indicators.filter((indicator) => keep.has(indicator.id))
  }, [indicatorsByCategory, selectedIndicatorId, snapshot.indicators, viewMode])

  const mapEdges = useMemo(() => {
    const allowed = new Set(mapIndicators.map((indicator) => indicator.id))
    const filtered = snapshot.edges.filter((edge) => allowed.has(edge.a) && allowed.has(edge.b))
    if (viewMode === 'advanced') return filtered
    return filtered.filter((edge) => edge.strength >= 0.45).slice(0, 48)
  }, [mapIndicators, snapshot.edges, viewMode])

  const selectedEdges = useMemo(() => {
    if (!selectedIndicator) return []
    return snapshot.edges
      .filter((edge) => edge.a === selectedIndicator.id || edge.b === selectedIndicator.id)
      .slice(0, viewMode === 'advanced' ? 10 : 6)
  }, [selectedIndicator, snapshot.edges, viewMode])

  const timeframe = (selectedInterval === '1d' ? '1d' : '4h') as AllowedInterval
  const isReportPage = route.page === 'report'
  const reportCluster = useMemo(() => {
    if (!isReportPage || route.time === null) return null
    return snapshot.timeline.find((cluster) => cluster.time === route.time) ?? null
  }, [isReportPage, route.time, snapshot.timeline])

  const activeTimelineCluster = useMemo(() => {
    if (snapshot.timeline.length === 0) return null
    return snapshot.timeline.find((cluster) => cluster.time === selectedClusterTime) ?? snapshot.timeline[snapshot.timeline.length - 1] ?? null
  }, [selectedClusterTime, snapshot.timeline])

  const pulseSummary = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        count: activeTimelineCluster?.laneCounts[category] ?? 0,
      })),
    [activeTimelineCluster],
  )

  const openCandleReport = useCallback(
    (time: number) => navigateToReport(selectedCoin, timeframe, time),
    [navigateToReport, selectedCoin, timeframe],
  )

  const { onPrev, onNext } = useMemo(() => {
    if (!isReportPage || route.time === null || snapshot.timeline.length === 0) {
      return { onPrev: null, onNext: null }
    }
    const idx = snapshot.timeline.findIndex((cluster) => cluster.time === route.time)
    if (idx === -1) return { onPrev: null, onNext: null }
    const prevTime = idx > 0 ? snapshot.timeline[idx - 1]!.time : null
    const nextTime = idx < snapshot.timeline.length - 1 ? snapshot.timeline[idx + 1]!.time : null
    return {
      onPrev: prevTime !== null ? () => navigateToReport(selectedCoin, timeframe, prevTime, { replace: true }) : null,
      onNext: nextTime !== null ? () => navigateToReport(selectedCoin, timeframe, nextTime, { replace: true }) : null,
    }
  }, [isReportPage, route.time, snapshot.timeline, navigateToReport, selectedCoin, timeframe])

  const latestRuntimeMessage = runtimeDiagnostics[runtimeDiagnostics.length - 1]?.message ?? null
  const healthStatus = snapshot.health.status
  const healthTone = toneFromHealthStatus(healthStatus)
  const healthLabel = snapshot.health.total > 0 ? `${snapshot.health.valid}/${snapshot.health.total} indicators` : '--'

  return (
    <div className="obs-app" data-testid="obs-shell">
      <div className="obs-backdrop-grid" />
      <div className="obs-shell-frame">
        <header className="obs-command-bar" data-testid="obs-command-bar">
          <div className="obs-command-bar__masthead">
            <div className="obs-brand-lockup">
              <div className="obs-brand">LevTrade</div>
              <div className="obs-brand-sub">Observatory / Hyperliquid market forensics</div>
            </div>

            <div className="obs-command-bar__view-switch">
              {!isReportPage && (
                <>
                  <button
                    type="button"
                    className={`obs-chip obs-chip--nav ${primaryView === 'timeline' ? 'obs-chip--active' : ''}`}
                    onClick={() => setPrimaryView('timeline')}
                    data-testid="obs-view-timeline"
                  >
                    Timeline
                  </button>
                  <button
                    type="button"
                    className={`obs-chip obs-chip--nav ${primaryView === 'network' ? 'obs-chip--active' : ''}`}
                    onClick={() => setPrimaryView('network')}
                    data-testid="obs-view-network"
                  >
                    Network
                  </button>
                </>
              )}

              <button
                type="button"
                className={`obs-chip obs-chip--nav ${viewMode === 'basic' ? 'obs-chip--active' : ''}`}
                onClick={() => setViewMode('basic')}
                data-testid="obs-mode-basic"
              >
                Basic
              </button>
              <button
                type="button"
                className={`obs-chip obs-chip--nav ${viewMode === 'advanced' ? 'obs-chip--active' : ''}`}
                onClick={() => setViewMode('advanced')}
                data-testid="obs-mode-advanced"
              >
                Advanced
              </button>
            </div>

            <div className="obs-command-bar__hero" data-testid="obs-price-strip">
              <div className="obs-command-bar__hero-label">{selectedCoin} / {timeframe}</div>
              <div className="obs-command-bar__hero-main">
                <span className="obs-price-hero__value">{formatPrice(priceContext.lastPrice)}</span>
                <span className={`obs-price-hero__change obs-price-hero__change--${toneFromNumber(priceContext.change24hPct)}`}>
                  {formatSignedPct(priceContext.change24hPct)}
                </span>
              </div>
              <div className="obs-command-bar__hero-meta">
                <span>{source === 'canonical' ? freshness : 'local'}</span>
                <span>{healthLabel}</span>
              </div>
            </div>
          </div>

          <div className="obs-command-bar__utility">
            <div className="obs-command-bar__utility-group">
              {ALLOWED_INTERVALS.map((interval) => (
                <button
                  key={interval}
                  type="button"
                  className={`obs-chip obs-chip--nav ${interval === timeframe ? 'obs-chip--active' : ''}`}
                  onClick={() => setInterval(interval)}
                  data-testid={`obs-interval-${interval}`}
                >
                  {interval}
                </button>
              ))}

              {!isReportPage && primaryView === 'timeline' && (
                <>
                  <button
                    type="button"
                    className={`obs-chip obs-chip--nav ${clusterMode === 'simple' ? 'obs-chip--active' : ''}`}
                    onClick={() => setClusterMode('simple')}
                    data-testid="obs-cluster-mode-simple"
                  >
                    Simple
                  </button>
                  <button
                    type="button"
                    className={`obs-chip obs-chip--nav ${clusterMode === 'pro' ? 'obs-chip--active' : ''}`}
                    onClick={() => setClusterMode('pro')}
                    data-testid="obs-cluster-mode-pro"
                  >
                    Pro
                  </button>
                </>
              )}
            </div>

            <div className="obs-command-bar__utility-group obs-command-bar__utility-group--status">
              <div className={`obs-connection obs-connection--${connectionStatus}`}>{connectionStatus}</div>
              <div className={`obs-freshness obs-freshness--${freshness}`}>{source === 'canonical' ? freshness : 'local'}</div>
              <button
                type="button"
                className={`obs-chip obs-chip--toggle obs-chip--${healthTone}`}
                onClick={() => setShowHealthDetail((value) => !value)}
                data-testid="obs-health-chip"
              >
                {healthLabel}
              </button>
              <button
                type="button"
                className={`obs-chip obs-chip--toggle ${runtimeDiagnostics.length > 0 ? 'obs-chip--warn' : ''}`}
                onClick={() => setShowRuntimeDetail((value) => !value)}
                data-testid="obs-chip-runtime"
              >
                {runtimeDiagnostics.length > 0 ? `Runtime ${runtimeDiagnostics.length}` : 'OK'}
              </button>
            </div>
          </div>
        </header>

        <section className="obs-market-strip">
          <div className="obs-market-strip__track-wrap">
            <div className="obs-strip-label">Tracked markets</div>
            <div className="obs-market-strip__track">
              {TRACKED_COINS.map((coin) => (
                <button
                  key={coin}
                  type="button"
                  className={`obs-market-tile ${coin === selectedCoin ? 'obs-market-tile--active obs-chip--active' : ''}`}
                  onClick={() => selectCoin(coin)}
                  data-testid={`obs-coin-${coin}`}
                >
                  <span className="obs-market-tile__symbol">{coin}</span>
                  <span className="obs-market-tile__price">{formatTickerPrice(prices[coin], coin === selectedCoin ? priceContext.lastPrice : null)}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {isReportPage ? (
          <section className="obs-report-shell">
            <CandleReportPage
              coin={selectedCoin}
              timeframe={timeframe}
              cluster={reportCluster}
              allIndicators={snapshot.indicators}
              loading={loading}
              onBack={navigateToHeatmap}
              onPrev={onPrev}
              onNext={onNext}
            />
          </section>
        ) : (
          <div className="obs-workspace">
            <main className="obs-main">
              {primaryView === 'timeline' ? (
                <section className="obs-canvas">
                  <div className="obs-panel obs-panel--canvas">
                    <div className="obs-panel__title-row">
                      <div>
                        <div className="obs-panel__eyebrow">Live chart</div>
                        <h2 className="obs-panel__title">Price geometry</h2>
                      </div>
                      <button type="button" className="obs-panel__toggle" onClick={() => setChartCollapsed((value) => !value)}>
                        {chartCollapsed ? 'Open chart' : 'Collapse chart'}
                      </button>
                    </div>

                    {!chartCollapsed && (
                      <div className="obs-chart-compact">
                        <PriceChart coin={selectedCoin} embedded showHeader={false} />
                      </div>
                    )}
                  </div>

                  <div className="obs-panel obs-panel--canvas">
                    <IndicatorClusterLanes
                      timeline={snapshot.timeline}
                      timeframe={timeframe}
                      mode={clusterMode}
                      selectedTime={selectedClusterTime}
                      onSelectTime={setSelectedClusterTime}
                      onOpenReport={openCandleReport}
                    />
                  </div>
                </section>
              ) : (
                <section className="obs-panel obs-panel--network-surface">
                  <div className="obs-panel__title-row">
                    <div>
                      <div className="obs-panel__eyebrow">Correlation surface</div>
                      <h2 className="obs-panel__title">Indicator network</h2>
                    </div>
                    <p className="obs-panel__hint">Color = sign, thickness = strength, dashed = lag</p>
                  </div>
                  <MapLegend />
                  <PoolMap
                    indicators={mapIndicators}
                    edges={mapEdges}
                    selectedId={selectedIndicatorId}
                    onSelect={setSelectedIndicatorId}
                    viewMode={viewMode}
                  />
                </section>
              )}
            </main>

            <aside className="obs-rail">
              {primaryView === 'timeline' ? (
                <section className="obs-panel obs-panel--rail">
                  <div className="obs-panel__eyebrow">Latest pulse</div>
                  <div className="obs-rail-card__headline">
                    {activeTimelineCluster ? new Date(activeTimelineCluster.time).toLocaleString() : 'No live cluster'}
                  </div>
                  <div className="obs-pulse-list">
                    {pulseSummary.map((item) => (
                      <div key={item.category} className="obs-pulse-row">
                        <span>{item.category}</span>
                        <span>{item.count}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <>
                  <section className="obs-panel obs-panel--rail">
                    <button type="button" className="obs-catalog-toggle" onClick={() => setCatalogOpen((value) => !value)}>
                      <div>
                        <div className="obs-panel__eyebrow">Catalog</div>
                        <h2 className="obs-panel__title">Indicator inventory</h2>
                      </div>
                      <span className="obs-catalog-toggle__chevron">{catalogOpen ? '\u2212' : '+'}</span>
                    </button>

                    {catalogOpen ? (
                      <div className="obs-panel__scroll">
                        {CATEGORY_ORDER.map((category) => {
                          const indicators = indicatorsByCategory[category]
                          if (indicators.length === 0) return null
                          return (
                            <div key={category} className="obs-category">
                              <div className="obs-category__title">{category}</div>
                              {indicators.map((indicator) => (
                                <button
                                  key={indicator.id}
                                  type="button"
                                  className={`obs-indicator-row ${indicator.id === selectedIndicatorId ? 'obs-indicator-row--active' : ''}`}
                                  onClick={() => setSelectedIndicatorId(indicator.id)}
                                  data-testid={`obs-indicator-row-${indicator.id}`}
                                >
                                  <span>{indicator.label}</span>
                                  <span className={`obs-state obs-state--${indicator.currentState}`}>{indicator.currentState}</span>
                                </button>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="obs-catalog-badges">
                        {CATEGORY_ORDER.map((category) => (
                          <div key={category} className="obs-catalog-badge">
                            <span className="obs-catalog-badge__label">{category.slice(0, 3)}</span>
                            <span
                              className={`obs-catalog-badge__dot ${
                                indicatorsByCategory[category].some((indicator) => indicator.currentState === 'high')
                                  ? 'obs-catalog-badge__dot--active'
                                  : 'obs-catalog-badge__dot--idle'
                              }`}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="obs-panel obs-panel--rail">
                    <div className="obs-panel__eyebrow">Selected indicator</div>
                    <h2 className="obs-panel__title">Drilldown</h2>
                    {selectedIndicator ? (
                      <>
                        <div className="obs-detail-head">
                          <div data-testid="obs-detail-title">{selectedIndicator.label}</div>
                          <div className={`obs-state obs-state--${selectedIndicator.currentState}`}>{selectedIndicator.currentState}</div>
                        </div>
                        <div className="obs-detail-metrics">
                          <div className="obs-detail-kv"><span>Current</span><span>{formatValue(selectedIndicator.currentValue, selectedIndicator.unit)}</span></div>
                          <div className="obs-detail-kv"><span>Quantile</span><span>{selectedIndicator.quantileBucket ?? '--'} ({formatPct(selectedIndicator.quantileRank)})</span></div>
                          <div className="obs-detail-kv"><span>Event active rate</span><span>{formatPct(selectedIndicator.frequency.activeRate)}</span></div>
                        </div>
                        <p className="obs-detail-copy">{selectedIndicator.description}</p>
                        <div className="obs-detail-subtitle">Strongest links</div>
                        <div className="obs-correlation-list">
                          {selectedEdges.map((edge) => {
                            const counterpartId = edge.a === selectedIndicator.id ? edge.b : edge.a
                            const counterpart = snapshot.indicators.find((indicator) => indicator.id === counterpartId)
                            if (!counterpart) return null
                            return (
                              <button key={`${edge.a}-${edge.b}`} type="button" className="obs-correlation-row" onClick={() => setSelectedIndicatorId(counterpart.id)}>
                                <span>{counterpart.label}</span>
                                <span>{edge.strength.toFixed(2)}</span>
                              </button>
                            )
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="obs-empty">Select an indicator from the list.</div>
                    )}
                  </section>
                </>
              )}

              {showRuntimeDetail && (
                <section className="obs-runtime" data-testid="obs-runtime-detail">
                  <span className="obs-runtime__tag">Runtime</span>
                  <span className="obs-runtime__msg">{latestRuntimeMessage ?? 'No runtime warnings currently.'}</span>
                  <button
                    type="button"
                    className="obs-runtime__clear"
                    onClick={() => {
                      clearRuntimeDiagnostics()
                      setShowRuntimeDetail(false)
                    }}
                  >
                    Clear
                  </button>
                </section>
              )}

              {showHealthDetail && (
                <section className="obs-health-panel" data-testid="obs-health-detail">
                  <div className="obs-health-panel__head">
                    <span className={`obs-health-panel__status obs-health-panel__status--${healthTone}`}>{snapshot.health.status}</span>
                    <span>{snapshot.health.valid}/{snapshot.health.total} indicators healthy</span>
                  </div>
                  {snapshot.health.warnings.length > 0 ? (
                    <div className="obs-health-panel__warnings">
                      {snapshot.health.warnings.map((warning) => (
                        <div key={`${warning.indicatorId}:${warning.kind}:${warning.message}`} className="obs-health-panel__warning">
                          <strong>{warning.indicatorLabel}</strong>
                          <span>{warning.message}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="obs-health-panel__ok">All indicator checks passed.</div>
                  )}
                </section>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}

function MapLegend() {
  return (
    <div className="obs-legend" data-testid="obs-map-legend">
      <div className="obs-legend__item"><span className="obs-legend__line obs-legend__line--pos" /> Positive correlation</div>
      <div className="obs-legend__item"><span className="obs-legend__line obs-legend__line--neg" /> Negative correlation</div>
      <div className="obs-legend__item"><span className="obs-legend__line obs-legend__line--thick" /> Thicker = stronger</div>
      <div className="obs-legend__item"><span className="obs-legend__line obs-legend__line--lag" /> Dashed = lead / lag</div>
    </div>
  )
}

function toneFromNumber(value: number | null): 'up' | 'down' | 'neutral' {
  if (value === null || !Number.isFinite(value)) return 'neutral'
  if (value > 0) return 'up'
  if (value < 0) return 'down'
  return 'neutral'
}

function toneFromHealthStatus(status: IndicatorHealthStatus): 'good' | 'warn' | 'critical' {
  if (status === 'healthy') return 'good'
  if (status === 'warning') return 'warn'
  return 'critical'
}

function formatPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '--'
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
}

function formatTickerPrice(value: string | number | null | undefined, fallback: number | null): string {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : Number.NaN
  if (Number.isFinite(numeric)) {
    return `$${numeric.toLocaleString(undefined, { maximumFractionDigits: numeric >= 1000 ? 0 : 2 })}`
  }
  if (fallback !== null && Number.isFinite(fallback)) {
    return `$${fallback.toLocaleString(undefined, { maximumFractionDigits: fallback >= 1000 ? 0 : 2 })}`
  }
  return '--'
}

function formatSignedPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '--'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatValue(value: number | null, unit: string): string {
  if (value === null || !Number.isFinite(value)) return '--'
  if (unit === '%') return `${value.toFixed(2)}%`
  if (unit === 'bp') return `${value.toFixed(2)} bp`
  if (unit === 'z') return value.toFixed(2)
  if (unit === '0-1') return value.toFixed(3)
  return value.toFixed(2)
}

function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '--'
  return `${(value * 100).toFixed(0)}%`
}

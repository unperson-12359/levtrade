import { useEffect, useMemo, useState } from 'react'
import { useDataManager } from '../../hooks/useDataManager'
import { useIndicatorObservatory } from '../../hooks/useIndicatorObservatory'
import type { IndicatorCategory } from '../../observatory/types'
import { useStore } from '../../store'
import { TRACKED_COINS } from '../../types/market'
import { PriceChart } from '../chart/PriceChart'
import { IndicatorClusterLanes } from './IndicatorClusterLanes'
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

  const { snapshot, priceContext, source, freshness, loading } = useIndicatorObservatory(selectedCoin)
  const [selectedIndicatorId, setSelectedIndicatorId] = useState<string | null>(null)
  const [selectedClusterTime, setSelectedClusterTime] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('basic')
  const [primaryView, setPrimaryView] = useState<PrimaryView>('timeline')

  useEffect(() => {
    if (selectedInterval !== '4h' && selectedInterval !== '1d') {
      setInterval('4h')
    }
  }, [selectedInterval, setInterval])

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
    if (snapshot.timeline.length === 0) {
      setSelectedClusterTime(null)
      return
    }
    const exists = snapshot.timeline.some((cluster) => cluster.time === selectedClusterTime)
    if (!exists) {
      setSelectedClusterTime(snapshot.timeline[snapshot.timeline.length - 1]?.time ?? null)
    }
  }, [selectedClusterTime, snapshot.timeline])

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

  const density = useMemo(() => {
    if (snapshot.indicators.length === 0) return 0
    return snapshot.edges.length / snapshot.indicators.length
  }, [snapshot.edges.length, snapshot.indicators.length])

  const selectedEdges = useMemo(() => {
    if (!selectedIndicator) return []
    return snapshot.edges
      .filter((edge) => edge.a === selectedIndicator.id || edge.b === selectedIndicator.id)
      .slice(0, viewMode === 'advanced' ? 10 : 6)
  }, [selectedIndicator, snapshot.edges, viewMode])

  const timeframe = (selectedInterval === '1d' ? '1d' : '4h') as AllowedInterval

  return (
    <div className="obs-app" data-testid="obs-shell">
      <div className="obs-backdrop-grid" />
      <header className="obs-topbar">
        <div className="obs-topbar__left">
          <div className="obs-brand">LEVTRADE SIGNAL POOL</div>
          <p className="obs-kicker">Observe behavior, do not predict it. Chart first, then indicator hit clusters by candle time.</p>
        </div>
        <div className="obs-topbar__right">
          <div className={`obs-connection obs-connection--${connectionStatus}`}>{connectionStatus}</div>
          <div className={`obs-freshness obs-freshness--${freshness}`}>{source === 'canonical' ? `Canonical ${freshness}` : 'Local fallback'}</div>
        </div>
      </header>

      {runtimeDiagnostics.length > 0 && (
        <div className="obs-runtime">
          <span className="obs-runtime__tag">Runtime</span>
          <span className="obs-runtime__msg">{runtimeDiagnostics[runtimeDiagnostics.length - 1]?.message}</span>
          <button type="button" className="obs-runtime__clear" onClick={clearRuntimeDiagnostics}>Clear</button>
        </div>
      )}

      <section className="obs-price-strip" data-testid="obs-price-strip">
        <PriceCell label={`${selectedCoin} Last Price`} value={formatPrice(priceContext.lastPrice)} tone="neutral" />
        <PriceCell label="24h Change" value={formatSignedPct(priceContext.change24hPct)} tone={toneFromNumber(priceContext.change24hPct)} />
        <PriceCell label={`${timeframe} Return`} value={formatSignedPct(priceContext.intervalReturnPct)} tone={toneFromNumber(priceContext.intervalReturnPct)} />
        <PriceCell label="Updated" value={new Date(priceContext.updatedAt).toLocaleTimeString()} tone="neutral" />
      </section>

      <section className="obs-policy" data-testid="obs-no-reco-copy">
        No recommendation mode: this platform explains what happened while price moved (or stalled); it does not output trading calls.
      </section>

      <section className="obs-controls">
        <div className="obs-chip-row">
          {TRACKED_COINS.map((coin) => (
            <button
              key={coin}
              type="button"
              className={`obs-chip ${coin === selectedCoin ? 'obs-chip--active' : ''}`}
              onClick={() => selectCoin(coin)}
              data-testid={`obs-coin-${coin}`}
            >
              {coin}
            </button>
          ))}
        </div>
        <div className="obs-chip-row">
          {ALLOWED_INTERVALS.map((interval) => (
            <button
              key={interval}
              type="button"
              className={`obs-chip ${interval === timeframe ? 'obs-chip--active' : ''}`}
              onClick={() => setInterval(interval)}
              data-testid={`obs-interval-${interval}`}
            >
              {interval}
            </button>
          ))}
          <button
            type="button"
            className={`obs-chip ${viewMode === 'basic' ? 'obs-chip--active' : ''}`}
            onClick={() => setViewMode('basic')}
            data-testid="obs-mode-basic"
          >
            Basic
          </button>
          <button
            type="button"
            className={`obs-chip ${viewMode === 'advanced' ? 'obs-chip--active' : ''}`}
            onClick={() => setViewMode('advanced')}
            data-testid="obs-mode-advanced"
          >
            Advanced
          </button>
          <button
            type="button"
            className={`obs-chip ${primaryView === 'timeline' ? 'obs-chip--active' : ''}`}
            onClick={() => setPrimaryView('timeline')}
            data-testid="obs-view-timeline"
          >
            Timeline
          </button>
          <button
            type="button"
            className={`obs-chip ${primaryView === 'network' ? 'obs-chip--active' : ''}`}
            onClick={() => setPrimaryView('network')}
            data-testid="obs-view-network"
          >
            Network
          </button>
        </div>
      </section>

      <section className="obs-summary">
        <SummaryCard label="Indicators" value={String(snapshot.indicators.length)} />
        <SummaryCard label="Hit Candles" value={String(snapshot.timeline.length)} />
        <SummaryCard label="Correlation Edges" value={String(snapshot.edges.length)} />
        <SummaryCard label="Edge Density" value={density.toFixed(2)} />
      </section>

      {primaryView === 'timeline' ? (
        <section className="obs-timeline-stack">
          <div className="obs-panel">
            <div className="obs-panel__title-row">
              <h2 className="obs-panel__title">Asset Chart</h2>
              <p className="obs-panel__hint">{loading ? 'Refreshing canonical snapshot...' : 'Top panel anchors behavior in price.'}</p>
            </div>
            <PriceChart coin={selectedCoin} embedded showHeader={false} />
          </div>

          <div className="obs-panel">
            <IndicatorClusterLanes
              timeline={snapshot.timeline}
              timeframe={timeframe}
              selectedTime={selectedClusterTime}
              onSelectTime={setSelectedClusterTime}
            />
          </div>
        </section>
      ) : (
        <main className="obs-grid">
          <aside className="obs-panel obs-panel--list">
            <h2 className="obs-panel__title">Indicator Catalog</h2>
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
          </aside>

          <section className="obs-panel obs-panel--map">
            <div className="obs-panel__title-row">
              <h2 className="obs-panel__title">Indicator Network</h2>
              <p className="obs-panel__hint">Color = sign, thickness = strength, dashed = lag.</p>
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

          <aside className="obs-panel obs-panel--detail">
            <h2 className="obs-panel__title">Indicator Drilldown</h2>
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
          </aside>
        </main>
      )}
    </div>
  )
}

function MapLegend() {
  return (
    <div className="obs-legend" data-testid="obs-map-legend">
      <div className="obs-legend__item"><span className="obs-legend__line obs-legend__line--pos" /> Positive correlation</div>
      <div className="obs-legend__item"><span className="obs-legend__line obs-legend__line--neg" /> Negative correlation</div>
      <div className="obs-legend__item"><span className="obs-legend__line obs-legend__line--thick" /> Thicker = stronger</div>
      <div className="obs-legend__item"><span className="obs-legend__line obs-legend__line--lag" /> Dashed = lead/lag</div>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="obs-summary-card">
      <div className="obs-summary-card__value">{value}</div>
      <div className="obs-summary-card__label">{label}</div>
    </article>
  )
}

function PriceCell({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'up' | 'down' | 'neutral'
}) {
  return (
    <article className={`obs-price-cell obs-price-cell--${tone}`}>
      <div className="obs-price-cell__label">{label}</div>
      <div className="obs-price-cell__value">{value}</div>
    </article>
  )
}

function toneFromNumber(value: number | null): 'up' | 'down' | 'neutral' {
  if (value === null || !Number.isFinite(value)) return 'neutral'
  if (value > 0) return 'up'
  if (value < 0) return 'down'
  return 'neutral'
}

function formatPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '--'
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
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

import { useEffect, useMemo, useState } from 'react'
import { INTERVALS } from '../../config/intervals'
import { useDataManager } from '../../hooks/useDataManager'
import { useIndicatorObservatory } from '../../hooks/useIndicatorObservatory'
import type { IndicatorCategory } from '../../observatory/types'
import { useStore } from '../../store'
import { TRACKED_COINS } from '../../types/market'
import { PoolMap } from './PoolMap'

const CATEGORY_ORDER: IndicatorCategory[] = ['Trend', 'Momentum', 'Volatility', 'Volume', 'Flow', 'Structure']

export function ObservatoryLayout() {
  useDataManager()

  const selectedCoin = useStore((state) => state.selectedCoin)
  const selectCoin = useStore((state) => state.selectCoin)
  const selectedInterval = useStore((state) => state.selectedInterval)
  const setInterval = useStore((state) => state.setInterval)
  const connectionStatus = useStore((state) => state.connectionStatus)
  const runtimeDiagnostics = useStore((state) => state.runtimeDiagnostics)
  const clearRuntimeDiagnostics = useStore((state) => state.clearRuntimeDiagnostics)

  const snapshot = useIndicatorObservatory(selectedCoin)
  const [selectedIndicatorId, setSelectedIndicatorId] = useState<string | null>(null)

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

  const selectedEdges = useMemo(() => {
    if (!selectedIndicator) return []
    return snapshot.edges
      .filter((edge) => edge.a === selectedIndicator.id || edge.b === selectedIndicator.id)
      .slice(0, 10)
  }, [selectedIndicator, snapshot.edges])

  const density = useMemo(() => {
    if (snapshot.indicators.length === 0) return 0
    return snapshot.edges.length / snapshot.indicators.length
  }, [snapshot.edges.length, snapshot.indicators.length])

  return (
    <div className="obs-app" data-testid="obs-shell">
      <div className="obs-backdrop-grid" />
      <header className="obs-topbar">
        <div className="obs-topbar__left">
          <div className="obs-brand">LEVTRADE SIGNAL POOL</div>
          <p className="obs-kicker">Descriptive indicator telemetry, frequency tracking, and cross-regime correlation.</p>
        </div>
        <div className="obs-topbar__right">
          <div className={`obs-connection obs-connection--${connectionStatus}`}>{connectionStatus}</div>
          <div className="obs-updated">{new Date(snapshot.generatedAt).toLocaleTimeString()}</div>
        </div>
      </header>

      {runtimeDiagnostics.length > 0 && (
        <div className="obs-runtime">
          <span className="obs-runtime__tag">Runtime</span>
          <span className="obs-runtime__msg">{runtimeDiagnostics[runtimeDiagnostics.length - 1]?.message}</span>
          <button type="button" className="obs-runtime__clear" onClick={clearRuntimeDiagnostics}>Clear</button>
        </div>
      )}

      <section className="obs-policy" data-testid="obs-no-reco-copy">
        No recommendation mode: this platform does not produce long/short calls, entries, exits, or leverage guidance.
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
          {INTERVALS.map((interval) => (
            <button
              key={interval}
              type="button"
              className={`obs-chip ${interval === selectedInterval ? 'obs-chip--active' : ''}`}
              onClick={() => setInterval(interval)}
              data-testid={`obs-interval-${interval}`}
            >
              {interval}
            </button>
          ))}
        </div>
      </section>

      <section className="obs-summary">
        <SummaryCard label="Indicators" value={String(snapshot.indicators.length)} />
        <SummaryCard label="Correlation Edges" value={String(snapshot.edges.length)} />
        <SummaryCard label="Edge Density" value={density.toFixed(2)} />
        <SummaryCard label="Bars Loaded" value={String(snapshot.candleCount)} />
      </section>

      <main className="obs-grid">
        <aside className="obs-panel obs-panel--list">
          <h2 className="obs-panel__title">Indicator Catalog</h2>
          <div className="obs-panel__scroll">
            {CATEGORY_ORDER.map((category) => {
              const indicators = indicatorsByCategory[category]
              if (!indicators || indicators.length === 0) return null
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
            <h2 className="obs-panel__title">2D Pool Map</h2>
            <p className="obs-panel__hint">Node clusters are grouped by indicator domain; links encode rolling correlation strength.</p>
          </div>
          <PoolMap
            indicators={snapshot.indicators}
            edges={snapshot.edges}
            selectedId={selectedIndicatorId}
            onSelect={setSelectedIndicatorId}
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
                <div className="obs-detail-kv">
                  <span>Current</span>
                  <span>{formatValue(selectedIndicator.currentValue, selectedIndicator.unit)}</span>
                </div>
                <div className="obs-detail-kv">
                  <span>Quantile</span>
                  <span>{selectedIndicator.quantileBucket ?? '--'} ({formatPct(selectedIndicator.quantileRank)})</span>
                </div>
                <div className="obs-detail-kv">
                  <span>Event active rate</span>
                  <span>{formatPct(selectedIndicator.frequency.activeRate)}</span>
                </div>
                <div className="obs-detail-kv">
                  <span>Transition rate</span>
                  <span>{formatPct(selectedIndicator.frequency.stateTransitionRate)}</span>
                </div>
              </div>
              <p className="obs-detail-copy">{selectedIndicator.description}</p>
              <div className="obs-detail-subtitle">Strongest links</div>
              <div className="obs-correlation-list">
                {selectedEdges.length > 0 ? (
                  selectedEdges.map((edge) => {
                    const counterpartId = edge.a === selectedIndicator.id ? edge.b : edge.a
                    const counterpart = snapshot.indicators.find((indicator) => indicator.id === counterpartId)
                    if (!counterpart) return null
                    return (
                      <button
                        key={`${edge.a}-${edge.b}`}
                        type="button"
                        className="obs-correlation-row"
                        onClick={() => setSelectedIndicatorId(counterpart.id)}
                      >
                        <span>{counterpart.label}</span>
                        <span>{edge.strength.toFixed(2)}</span>
                      </button>
                    )
                  })
                ) : (
                  <div className="obs-empty">Not enough aligned samples yet.</div>
                )}
              </div>
            </>
          ) : (
            <div className="obs-empty">Waiting for indicator history...</div>
          )}
        </aside>
      </main>

      <section className="obs-panel obs-panel--table">
        <div className="obs-panel__title-row">
          <h2 className="obs-panel__title">Top Correlation Pairs</h2>
          <p className="obs-panel__hint">Pearson, Spearman, and lag-adjusted correlation are blended in the edge strength score.</p>
        </div>
        <div className="obs-table">
          <div className="obs-table__head">
            <span>Pair</span>
            <span>Pearson</span>
            <span>Spearman</span>
            <span>Lag</span>
            <span>Strength</span>
          </div>
          {snapshot.edges.slice(0, 12).map((edge) => {
            const left = snapshot.indicators.find((indicator) => indicator.id === edge.a)
            const right = snapshot.indicators.find((indicator) => indicator.id === edge.b)
            if (!left || !right) return null
            return (
              <div key={`${edge.a}-${edge.b}`} className="obs-table__row">
                <span>{left.label} x {right.label}</span>
                <span>{edge.pearson.toFixed(2)}</span>
                <span>{edge.spearman.toFixed(2)}</span>
                <span>{edge.lagBars >= 0 ? `+${edge.lagBars}` : edge.lagBars} bars</span>
                <span>{edge.strength.toFixed(2)}</span>
              </div>
            )
          })}
        </div>
      </section>
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

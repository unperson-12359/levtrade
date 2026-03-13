import {
  formatConnectionStatus,
  formatLiveStatus,
  formatPrice,
  formatSignedPct,
  formatTickerPrice,
  toneFromNumber,
} from '../../observatory/format'
import { formatUtcDateTime } from '../../observatory/timeFormat'
import type { IndicatorCategory } from '../../observatory/types'
import { useObservatoryState } from '../../hooks/useObservatoryState'
import { TRACKED_COINS } from '../../types/market'
import { PriceChart } from '../chart/PriceChart'
import { AnalyticsPage } from './AnalyticsPage'
import { IndicatorClusterLanes } from './IndicatorClusterLanes'
import { CandleReportPage } from './CandleReportPage'
import { MethodologyPage } from './MethodologyPage'
import { CorrelationInsights } from './CorrelationInsights'

const CATEGORY_ORDER: IndicatorCategory[] = ['Trend', 'Momentum', 'Volatility', 'Volume', 'Structure']

export function ObservatoryLayout() {
  const {
    selectedCoin,
    timeframe,
    prices,
    snapshot,
    priceContext,
    loading,
    primaryView,
    setPrimaryView,
    clusterMode,
    setClusterMode,
    showDiagnostics,
    setShowDiagnostics,
    chartCollapsed,
    setChartCollapsed,
    menuOpen,
    setMenuOpen,
    reportDrawerOpen,
    closeReportDrawer,
    methodologyModalOpen,
    closeMethodologyModal,
    selectedClusterTime,
    setSelectedClusterTime,
    selectedTimelineCluster,
    selectedClusterCategory,
    reportCluster,
    openCandleReport,
    openObservatory,
    openAnalytics,
    openMethodology,
    handleSelectCoin,
    onPrev,
    onNext,
    isAnalyticsPage,
    isTimelineView,
    healthTone,
    diagnosticsCount,
    hasDiagnostics,
    liveDisplayStatus,
    latestRuntimeMessage,
    connectionStatus,
  } = useObservatoryState()

  return (
    <div className="obs-app" data-testid="obs-shell">
      <div className="obs-backdrop-grid" />
      <div className="obs-shell-frame">
        <header className="obs-command-bar" data-testid="obs-command-bar">
          <div className="obs-command-bar__row">
            <div className="obs-brand-lockup">
              <div className="obs-brand">LevTrade</div>
              <div className="obs-brand-sub">Observatory / Hyperliquid market forensics</div>
            </div>

            <nav className="obs-global-nav" aria-label="Primary" data-testid="obs-global-nav">
              <button
                type="button"
                className={`obs-chip obs-chip--nav ${!isAnalyticsPage ? 'obs-chip--active' : ''}`}
                onClick={openObservatory}
                data-testid="obs-nav-observatory"
              >
                Observatory
              </button>
              <button
                type="button"
                className={`obs-chip obs-chip--nav ${isAnalyticsPage ? 'obs-chip--active' : ''}`}
                onClick={openAnalytics}
                data-testid="obs-nav-analytics"
              >
                Analytics
              </button>
              <button
                type="button"
                className="obs-chip obs-chip--nav"
                onClick={openMethodology}
                data-testid="obs-nav-methodology"
              >
                Methodology
              </button>
            </nav>

            <div className="obs-command-bar__utility-group obs-command-bar__utility-group--view">
              {!isAnalyticsPage ? (
                <div className="obs-toggle-group">
                  <span className="obs-toggle-group__label">View</span>
                  <div className="obs-toggle-group__chips">
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
                      Insights
                    </button>
                  </div>
                </div>
              ) : (
                <div className="obs-command-bar__page-tag">
                  Deep dive / Analytics and persistence
                </div>
              )}
            </div>

            <div className="obs-command-bar__utility-group obs-command-bar__utility-group--coins">
              {TRACKED_COINS.map((coin) => (
                <button
                  key={coin}
                  type="button"
                  className={`obs-chip obs-chip--coin ${coin === selectedCoin ? 'obs-chip--active' : ''}`}
                  onClick={() => handleSelectCoin(coin)}
                  data-testid={`obs-coin-${coin}`}
                >
                  <span className="obs-chip__coin-symbol">{coin}</span>
                  <span className="obs-chip__coin-price">{formatTickerPrice(prices[coin], coin === selectedCoin ? priceContext.lastPrice : null)}</span>
                </button>
              ))}
            </div>

            <div className="obs-command-bar__utility-group">
              {!isAnalyticsPage && primaryView === 'timeline' && (
                <div className="obs-toggle-group">
                  <span className="obs-toggle-group__label">Detail</span>
                  <div className="obs-toggle-group__chips">
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
                  </div>
                </div>
              )}
            </div>

            <div className="obs-command-bar__hero obs-command-bar__hero--inline" data-testid="obs-price-strip">
              <div className="obs-command-bar__hero-main">
                <span className="obs-command-bar__hero-label">{selectedCoin}</span>
                <span className="obs-price-hero__value">{formatPrice(priceContext.lastPrice)}</span>
                <span className={`obs-price-hero__change obs-price-hero__change--${toneFromNumber(priceContext.change24hPct)}`}>
                  {formatSignedPct(priceContext.change24hPct)}
                </span>
              </div>
            </div>

            <div className="obs-command-bar__utility-group obs-command-bar__utility-group--status">
              <div className={`obs-connection obs-connection--${connectionStatus}`}>{formatConnectionStatus(connectionStatus)}</div>
              <div className={`obs-live-status obs-live-status--${liveDisplayStatus}`} data-testid="obs-live-status">
                {formatLiveStatus(liveDisplayStatus)}
              </div>
              {hasDiagnostics ? (
                <button
                  type="button"
                  className={`obs-chip obs-chip--toggle obs-chip--${healthTone}`}
                  onClick={() => setShowDiagnostics(!showDiagnostics)}
                  aria-expanded={showDiagnostics}
                  aria-controls="obs-diagnostics-detail"
                  data-testid="obs-diagnostics-toggle"
                >
                  Diagnostics {diagnosticsCount}
                </button>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            className="obs-header-menu"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-controls="obs-mobile-nav"
            data-testid="obs-header-menu-button"
          >
            Menu
          </button>

          {menuOpen && (
            <nav id="obs-mobile-nav" className="obs-mobile-nav" aria-label="Mobile">
              <button
                type="button"
                className={`obs-chip obs-chip--nav ${!isAnalyticsPage ? 'obs-chip--active' : ''}`}
                onClick={openObservatory}
              >
                Observatory
              </button>
              <button
                type="button"
                className={`obs-chip obs-chip--nav ${isAnalyticsPage ? 'obs-chip--active' : ''}`}
                onClick={openAnalytics}
              >
                Analytics
              </button>
              <button
                type="button"
                className="obs-chip obs-chip--nav"
                onClick={openMethodology}
              >
                Methodology
              </button>
            </nav>
          )}
        </header>

        <>
            <div className={`obs-workspace ${isTimelineView ? 'obs-workspace--timeline' : ''}`}>
            <main className={`obs-main ${isTimelineView ? 'obs-main--timeline' : ''}`}>
              {isTimelineView ? (
                <section className="obs-canvas obs-canvas--timeline">
                  <div className="obs-panel obs-panel--canvas">
                    <div className="obs-panel__title-row">
                      <div>
                        <div className="obs-panel__eyebrow">Step 1 · Start with market state</div>
                        <h2 className="obs-panel__title">Price path and recent context</h2>
                      </div>
                      <button
                        type="button"
                        className="obs-panel__toggle"
                        onClick={() => setChartCollapsed(!chartCollapsed)}
                        aria-expanded={!chartCollapsed}
                        aria-controls="obs-live-chart-panel"
                      >
                        {chartCollapsed ? 'Open chart' : 'Collapse chart'}
                      </button>
                    </div>

                    <p className="obs-panel__lead">
                      Read the live price, 24h change, and last update first. The heatmap matters more when the market context above feels coherent.
                    </p>

                    {!chartCollapsed && (
                      <div id="obs-live-chart-panel" className="obs-chart-compact">
                        <PriceChart
                          coin={selectedCoin}
                          embedded
                          showHeader={false}
                          timeline={snapshot.timeline}
                          selectedTime={selectedClusterTime}
                          clusterMode={clusterMode}
                          onSelectClusterTime={setSelectedClusterTime}
                          onOpenClusterReport={openCandleReport}
                        />
                      </div>
                    )}
                  </div>
                </section>
              ) : (
                <>
                  <section className="obs-panel obs-panel--insights-surface">
                    <div className="obs-panel__title-row">
                      <div>
                        <div className="obs-panel__eyebrow">Correlation insights</div>
                        <h2 className="obs-panel__title">What the indicators are telling you</h2>
                      </div>
                    </div>
                    <CorrelationInsights
                      indicators={snapshot.indicators}
                      edges={snapshot.edges}
                      timeline={snapshot.timeline}
                    />
                  </section>
                  <AnalyticsPage coin={selectedCoin} timeframe={timeframe} snapshot={snapshot} />
                </>
              )}
            </main>

            {isTimelineView && (
            <aside className="obs-rail obs-rail--timeline">
              {isTimelineView ? (
                <>
                  <section className="obs-panel obs-panel--rail obs-panel--heatmap-rail">
                    <IndicatorClusterLanes
                      layout="side-rail"
                      timeline={snapshot.timeline}
                      timeframe={timeframe}
                      mode={clusterMode}
                      selectedTime={selectedClusterTime}
                      onSelectTime={setSelectedClusterTime}
                    />
                  </section>

                  <section className="obs-panel obs-panel--rail obs-panel--selected-cluster" data-testid="obs-selected-cluster-card">
                    <div className="obs-panel__eyebrow">Explain the selected candle</div>
                    <div className="obs-rail-card__headline">
                      {selectedTimelineCluster ? formatUtcDateTime(selectedTimelineCluster.time) : 'No selected cluster'}
                    </div>
                    <p className="obs-panel__copy">
                      Use this card to turn heatmap pressure into meaning before opening the full report.
                    </p>
                    {selectedTimelineCluster ? (
                      <>
                        <div className="obs-selected-cluster__metrics">
                          <div className="obs-detail-kv"><span>Active indicators</span><span>{selectedTimelineCluster.totalHits}</span></div>
                          <div className="obs-detail-kv"><span>Dominant category</span><span>{selectedClusterCategory ?? '--'}</span></div>
                          <div className="obs-detail-kv"><span>Price change</span><span>{formatSignedPct(selectedTimelineCluster.price.changePct)}</span></div>
                          <div className="obs-detail-kv"><span>Close</span><span>{formatPrice(selectedTimelineCluster.price.close)}</span></div>
                        </div>
                        <div className="obs-selected-cluster__lanes">
                          {CATEGORY_ORDER.map((category) => (
                            <div key={category} className="obs-pulse-row">
                              <span>{category}</span>
                              <span>{selectedTimelineCluster.laneCounts[category] ?? 0}</span>
                            </div>
                          ))}
                        </div>
                        <div className="obs-selected-cluster__events">
                          {selectedTimelineCluster.topHits.slice(0, 3).map((hit) => (
                            <div key={hit.id} className="obs-selected-cluster__event">
                              <strong>{hit.indicatorLabel}</strong>
                              <span>{hit.message}</span>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          className="obs-panel__action"
                          onClick={() => openCandleReport(selectedTimelineCluster.time)}
                          data-testid="obs-selected-cluster-open-report"
                        >
                          Open detailed report
                        </button>
                      </>
                    ) : (
                      <div className="obs-empty">{loading && snapshot.timeline.length === 0 ? 'Loading indicators\u2026' : 'Select a heatmap cell to explain why that candle mattered, then open the report only if you need deeper context.'}</div>
                    )}
                  </section>

                </>
              ) : null}

              {showDiagnostics && hasDiagnostics && (
                <section id="obs-diagnostics-detail" className="obs-diagnostics-panel" data-testid="obs-diagnostics-panel">
                  <div className="obs-diagnostics-panel__head">
                    <div>
                      <div className="obs-panel__eyebrow">Diagnostics</div>
                      <h2 className="obs-panel__title">Secondary checks, not the primary read</h2>
                    </div>
                    <button
                      type="button"
                      className="obs-runtime__clear"
                      onClick={() => setShowDiagnostics(false)}
                    >
                      Hide
                    </button>
                  </div>
                  <div className="obs-diagnostics-panel__grid">
                    <div className="obs-diagnostics-card">
                      <span className={`obs-health-panel__status obs-health-panel__status--${healthTone}`}>{snapshot.health.status}</span>
                      <div className="obs-runtime__msg">
                        {snapshot.health.valid}/{snapshot.health.total} indicators healthy
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
                        <div className="obs-health-panel__ok">No indicator warnings are active.</div>
                      )}
                    </div>

                    <div className="obs-diagnostics-card">
                      <span className="obs-runtime__tag">Runtime</span>
                      <span className="obs-runtime__msg">{latestRuntimeMessage ?? 'No runtime warnings currently.'}</span>
                      <div className="obs-health-panel__ok">
                        Connection {formatConnectionStatus(connectionStatus).toLowerCase()} · {formatLiveStatus(liveDisplayStatus).toLowerCase()}
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </aside>
            )}
            </div>

            {reportDrawerOpen && reportCluster && (
              <section className="obs-report-drawer" data-testid="obs-report-drawer">
                <CandleReportPage
                  coin={selectedCoin}
                  timeframe={timeframe}
                  cluster={reportCluster}
                  timeline={snapshot.timeline}
                  allIndicators={snapshot.indicators}
                  loading={loading}
                  onBack={closeReportDrawer}
                  onPrev={onPrev}
                  onNext={onNext}
                />
              </section>
            )}
          </>

        <MethodologyPage
          coin={selectedCoin}
          timeframe={timeframe}
          open={methodologyModalOpen}
          onClose={closeMethodologyModal}
          onOpenObservatory={openObservatory}
          onOpenAnalytics={openAnalytics}
        />
      </div>
    </div>
  )
}


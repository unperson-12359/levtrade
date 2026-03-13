import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const signals = await import('../api/_signals.mjs')
const {
  buildClosedIndicatorStateRecords,
  buildIndicatorStateRecords,
  buildObservatorySnapshot,
  buildPersistedObservatoryAnalytics,
  getClosedBarTimes,
} = signals

runObservatoryRuntimeSourceCheck()
runChartSimplificationSourceCheck()
runObservatoryApiBundlingSourceCheck()
runObservatoryShellSourceCheck()
runObservatoryCleanupSourceCheck()
runRuntimeStabilitySourceCheck()
runObservatoryIndicatorHealthTest()
runObservatoryBooleanStateTest()
runClosedBarPersistenceFilterTest()
runPersistedAnalyticsTest()
runContractInterfaceSourceCheck()
runObservatoryRemoteResetSourceCheck()
runClusterResizeSourceCheck()
runObservatoryAccessibilitySourceCheck()
runObservatoryUtcTimeSourceCheck()
runObservatoryPersistenceSourceCheck()
runObservatoryAnalyticsSourceCheck()
runBundleDriftCheck()

console.log('Logic regression checks passed')

function runObservatoryRuntimeSourceCheck() {
  const managerSource = readFileSync(join(__dirname, '../src/services/dataManager.ts'), 'utf8')
  const dataHookSource = readFileSync(join(__dirname, '../src/hooks/useDataManager.ts'), 'utf8')
  const storeSource = readFileSync(join(__dirname, '../src/store/index.ts'), 'utf8')
  const marketSliceSource = readFileSync(join(__dirname, '../src/store/marketDataSlice.ts'), 'utf8')
  const uiSliceSource = readFileSync(join(__dirname, '../src/store/uiSlice.ts'), 'utf8')
  const engineeringMapSource = readFileSync(join(__dirname, '../docs/engineering-map.md'), 'utf8')
  const parityChecklistSource = readFileSync(join(__dirname, '../docs/production-parity-checklist.md'), 'utf8')

  assert.match(managerSource, /fetchAllMids/)
  assert.match(managerSource, /fetchCandles/)
  assert.match(managerSource, /HyperliquidWS/)
  assert.match(managerSource, /scheduleNextPoll/)
  assert.match(managerSource, /runPollingCycle/)
  assert.match(managerSource, /executePollingCycle/)
  assert.doesNotMatch(managerSource, /fetchFundingHistory|fetchFearGreed|fetchCoinGeckoGlobal|fetchBinanceFundingRate|fetchBinanceOpenInterest/)
  assert.doesNotMatch(managerSource, /fetchServerSetups|fetchCollectorHeartbeatStatus|fetchExecutionEvents|uploadLocalSetups/)

  assert.doesNotMatch(dataHookSource, /computeAllSignals/)
  assert.doesNotMatch(dataHookSource, /signalInputsVersion/)
  assert.match(storeSource, /createMarketDataSlice/)
  assert.match(storeSource, /createUISlice/)
  assert.doesNotMatch(storeSource, /createSignalsSlice|createContextSlice|riskInputs|lastSignalComputedAt/)
  assert.match(marketSliceSource, /Record<TrackedCoin, Record<ObservatoryCandleInterval, Candle\[]>>/)
  assert.match(marketSliceSource, /interval = get\(\)\.selectedInterval/)
  assert.doesNotMatch(marketSliceSource, /fundingHistory|oiHistory|assetContexts|extendedCandles|resolutionCandles|verificationCandles|appendCandle|errors|addError|clearErrors/)
  assert.doesNotMatch(uiSliceSource, /riskInputs|updateRiskInput|resetRiskInputs|expandedSections|toggleSection/)
  assert.match(uiSliceSource, /observatoryGuideExpanded/)
  assert.match(uiSliceSource, /toggleObservatoryGuideExpanded/)
  assert.match(managerSource, /recentRefreshBars/)
  assert.match(managerSource, /mergeCandles/)
  assert.match(managerSource, /resolveCandleFetchMode/)
  assert.match(managerSource, /const interval = this\.interval/)
  assert.match(dataHookSource, /manager\.fetchAllCandles\(\[selectedCoin\], 'smart'\)/)
  assert.doesNotMatch(dataHookSource, /manager\.fetchAllCandles\(\[selectedCoin\], 'full'\)/)

  assert.match(engineeringMapSource, /current mounted product: the live observatory shell/i)
  assert.match(parityChecklistSource, /api\/observatory-snapshot\.ts/)
  assert.match(parityChecklistSource, /observatory_indicator_states/)
  assert.doesNotMatch(parityChecklistSource, /tracked_signals|server_setups|collector_heartbeat/)
}

function runChartSimplificationSourceCheck() {
  const chartSource = readFileSync(join(__dirname, '../src/components/chart/PriceChart.tsx'), 'utf8')
  const chartModelSource = readFileSync(join(__dirname, '../src/hooks/useChartModel.ts'), 'utf8')
  const reportSource = readFileSync(join(__dirname, '../src/components/observatory/CandleReportPage.tsx'), 'utf8')

  assert.doesNotMatch(chartSource, /useSignals|SuggestedSetup|verificationSetup|reviewMode/)
  assert.doesNotMatch(chartModelSource, /usePositionRisk|signals\[coin\]|verificationSetup|SuggestedSetup/)
  assert.match(chartSource, /Building the initial band context from recent candles/)
  assert.match(chartSource, /Live chart context is delayed/)
  assert.match(chartSource, /timeline\?: CandleHitCluster\[]/)
  assert.match(chartSource, /data-testid="obs-chart-cluster-overlay"/)
  assert.match(chartSource, /data-testid="obs-chart-cluster-bubble"/)
  assert.match(chartSource, /subscribeVisibleTimeRangeChange/)
  assert.match(chartSource, /priceToCoordinate/)
  assert.match(chartSource, /displayCount/)
  assert.doesNotMatch(chartSource, /chart-cluster-bubble__hits|chart-cluster-bubble__hit/)
  assert.match(chartModelSource, /BOLLINGER_PERIOD = 20/)
  assert.match(chartModelSource, /state\.candles\[coin\]\[selectedInterval\]/)
  assert.match(reportSource, /<PriceChart coin=\{coin\} embedded showHeader=\{false\} \/>/)
}

function runObservatoryApiBundlingSourceCheck() {
  const observatoryApiSource = readFileSync(join(__dirname, '../api/observatory-snapshot.ts'), 'utf8')
  const analyticsHelperSource = readFileSync(join(__dirname, '../api/_observatoryAnalytics.ts'), 'utf8')
  const apiEntrySource = readFileSync(join(__dirname, '../src/signals/api-entry.ts'), 'utf8')
  const declarationsSource = readFileSync(join(__dirname, '../api/_signals.d.mts'), 'utf8')

  assert.match(observatoryApiSource, /from '\.\/_signals\.mjs'/)
  assert.doesNotMatch(observatoryApiSource, /fundingHistory|oiHistory/)
  assert.match(analyticsHelperSource, /from '\.\/_signals\.mjs'/)
  assert.match(apiEntrySource, /buildObservatorySnapshot/)
  assert.match(apiEntrySource, /buildPersistedObservatoryAnalytics/)
  assert.doesNotMatch(apiEntrySource, /computeSuggestedSetup|computeSignalsAtTime|resolveSetupWindow/)
  assert.doesNotMatch(declarationsSource, /computeSuggestedSetup|computeSignalsAtTime|resolveSetupWindow|buildSetupId/)
}

function runObservatoryShellSourceCheck() {
  const layoutSource = readFileSync(join(__dirname, '../src/components/observatory/ObservatoryLayout.tsx'), 'utf8')
  const analyticsSource = readFileSync(join(__dirname, '../src/components/observatory/AnalyticsPage.tsx'), 'utf8')
  const reportSource = readFileSync(join(__dirname, '../src/components/observatory/CandleReportPage.tsx'), 'utf8')
  const clusterSource = readFileSync(join(__dirname, '../src/components/observatory/IndicatorClusterLanes.tsx'), 'utf8')
  const methodologySource = readFileSync(join(__dirname, '../src/components/observatory/MethodologyPage.tsx'), 'utf8')
  const methodologyContentSource = readFileSync(join(__dirname, '../src/components/observatory/methodologyContent.ts'), 'utf8')
  const observatoryHookSource = readFileSync(join(__dirname, '../src/hooks/useIndicatorObservatory.ts'), 'utf8')
  const routerSource = readFileSync(join(__dirname, '../src/hooks/useHashRouter.ts'), 'utf8')
  const cssSource = readFileSync(join(__dirname, '../src/index.css'), 'utf8')

  assert.match(layoutSource, /data-testid="obs-shell"/)
  assert.match(layoutSource, /data-testid="obs-command-bar"/)
  assert.match(layoutSource, /data-testid="obs-price-strip"/)
  assert.match(layoutSource, /data-testid="obs-live-status"/)
  assert.match(layoutSource, /data-testid="obs-nav-observatory"/)
  assert.match(layoutSource, /data-testid="obs-nav-analytics"/)
  assert.match(layoutSource, /data-testid="obs-nav-methodology"/)
  assert.match(layoutSource, /data-testid="obs-selected-cluster-open-report"/)
  assert.match(layoutSource, /timeline=\{snapshot\.timeline\}/)
  assert.match(layoutSource, /selectedTime=\{selectedClusterTime\}/)
  assert.match(layoutSource, /clusterMode=\{clusterMode\}/)
  assert.match(layoutSource, /onOpenClusterReport=\{openCandleReport\}/)
  assert.match(analyticsSource, /data-testid="obs-analytics-page"/)
  assert.match(analyticsSource, /data-testid="obs-analytics-table"/)
  assert.match(analyticsSource, /data-testid="obs-analytics-inspector"/)
  assert.match(analyticsSource, /data-testid="obs-analytics-source"/)
  assert.match(reportSource, /data-testid="obs-candle-report-page"/)
  assert.match(reportSource, /data-testid="obs-report-metrics"/)
  assert.match(reportSource, /data-testid="obs-report-active-context"/)
  assert.match(reportSource, /data-testid="obs-report-category-share"/)
  assert.match(clusterSource, /data-testid="obs-cluster-lanes"/)
  assert.match(clusterSource, /data-testid="obs-cluster-cell"/)
  assert.match(methodologySource, /data-testid="obs-methodology-page"/)
  assert.match(methodologySource, /data-testid="obs-methodology-flow"/)
  assert.match(methodologySource, /data-testid="obs-methodology-pages"/)
  assert.match(methodologySource, /data-testid="obs-methodology-live"/)
  assert.match(methodologySource, /data-testid="obs-methodology-workflow"/)
  assert.doesNotMatch(methodologySource, /How to know what you can trust/)
  assert.doesNotMatch(methodologyContentSource, /Canonical vs local|How recent the canonical snapshot is|category: 'Flow'/)
  assert.match(observatoryHookSource, /export type ObservatoryLiveStatus = 'live' \| 'updating' \| 'delayed' \| 'disconnected'/)
  assert.doesNotMatch(observatoryHookSource, /canonicalInterval|CanonicalResponse|fundingHistory|oiHistory/)
  assert.match(routerSource, /#\/observatory/)
  assert.match(routerSource, /#\/observatory\/report/)
  assert.match(routerSource, /#\/analytics/)
  assert.match(routerSource, /#\/methodology/)
  assert.match(routerSource, /buildObservatoryHash/)
  assert.match(routerSource, /buildAnalyticsHash/)
  assert.match(routerSource, /buildMethodologyHash/)
  assert.match(layoutSource, /reportDrawerOpen/)
  assert.match(layoutSource, /closeReportDrawer/)
  assert.match(layoutSource, /methodologyModalOpen/)
  assert.match(layoutSource, /closeMethodologyModal/)
  assert.match(cssSource, /\.obs-command-bar \{/)
  assert.match(cssSource, /\.obs-methodology \{/)
  assert.match(cssSource, /\.obs-live-status \{/)
  assert.match(cssSource, /\.obs-diagnostics-panel \{/)
  assert.match(cssSource, /\.chart-cluster-overlay \{/)
  assert.match(cssSource, /\.chart-cluster-bubble \{/)
  assert.match(cssSource, /\.chart-cluster-bubble--l1 \{/)
  assert.match(cssSource, /\.chart-cluster-bubble__count \{/)
  assert.doesNotMatch(cssSource, /\.chart-cluster-bubble__hits \{|\.chart-cluster-bubble__hit \{/)
}

function runObservatoryCleanupSourceCheck() {
  const packageSource = readFileSync(join(__dirname, '../package.json'), 'utf8')
  const contractsSource = readFileSync(join(__dirname, '../src/contracts/v1.ts'), 'utf8')

  const removedFiles = [
    '../src/store/contextSlice.ts',
    '../src/store/signalsSlice.ts',
    '../src/hooks/useSignals.ts',
    '../src/hooks/useSuggestedPosition.ts',
    '../src/hooks/usePositionRisk.ts',
    '../src/signals/backfill.ts',
    '../src/signals/composite.ts',
    '../src/signals/decision.ts',
    '../src/signals/entryGeometry.ts',
    '../src/signals/funding.ts',
    '../src/signals/hurst.ts',
    '../src/signals/index.ts',
    '../src/signals/oiDelta.ts',
    '../src/signals/positionPolicy.ts',
    '../src/signals/provisionalSetup.ts',
    '../src/signals/resolveOutcome.ts',
    '../src/signals/risk.ts',
    '../src/signals/setup.ts',
    '../src/signals/setupMetrics.ts',
    '../src/signals/suggestedPosition.ts',
    '../src/signals/volatility.ts',
    '../src/signals/zscore.ts',
    '../src/utils/colors.ts',
    '../src/utils/contextGuidance.ts',
    '../src/utils/explanations.ts',
    '../src/utils/format.ts',
    '../src/utils/identity.ts',
    '../src/utils/oiSeries.ts',
    '../src/utils/contextFreshness.ts',
    '../src/utils/candleTime.ts',
    '../src/utils/setupCoverage.ts',
    '../src/types/context.ts',
    '../src/types/position.ts',
    '../src/types/risk.ts',
    '../src/types/setup.ts',
    '../src/types/signals.ts',
    '../src/components/shared/SignalBadge.tsx',
    '../src/components/shared/CollapsibleSection.tsx',
    '../src/components/shared/JargonTerm.tsx',
    '../src/components/shared/Tooltip.tsx',
    '../src/utils/jargon.ts',
    '../docs/sonarx-adapter-spec.md',
    '../docs/sonarx-feasibility.md',
    '../docs/sonarx-parity-checklist.md',
    '../deploy/oracle/README.md',
    '../deploy/oracle/levtrade-collector.service',
    '../supabase/app_state.sql',
    '../supabase/oi_snapshots.sql',
  ]

  for (const relativePath of removedFiles) {
    assert.equal(existsSync(join(__dirname, relativePath)), false, `${relativePath} should have been removed`)
  }

  assert.match(contractsSource, /export type DataSourceV1 = 'derived' \| 'ledger'/)
  assert.doesNotMatch(packageSource, /build:api-collector|build:collector|collector:once|collector:start|repair:server-outcomes/)
}

function runRuntimeStabilitySourceCheck() {
  const appSource = readFileSync(join(__dirname, '../src/App.tsx'), 'utf8')
  const mainSource = readFileSync(join(__dirname, '../src/main.tsx'), 'utf8')
  const uiSliceSource = readFileSync(join(__dirname, '../src/store/uiSlice.ts'), 'utf8')
  const storeSource = readFileSync(join(__dirname, '../src/store/index.ts'), 'utf8')
  const managerSource = readFileSync(join(__dirname, '../src/services/dataManager.ts'), 'utf8')
  const layoutSource = readFileSync(join(__dirname, '../src/components/observatory/ObservatoryLayout.tsx'), 'utf8')
  const stateHookSource = readFileSync(join(__dirname, '../src/hooks/useObservatoryState.ts'), 'utf8')
  const cssSource = readFileSync(join(__dirname, '../src/index.css'), 'utf8')

  assert.match(appSource, /AppErrorBoundary/)
  assert.match(mainSource, /window\.addEventListener\('error'/)
  assert.match(mainSource, /window\.addEventListener\('unhandledrejection'/)
  assert.match(mainSource, /__levtradeRuntimeHooksInstalled/)
  assert.match(uiSliceSource, /runtimeDiagnostics/)
  assert.match(uiSliceSource, /pushRuntimeDiagnostic/)
  assert.match(uiSliceSource, /selectedInterval: '1d'/)
  assert.match(uiSliceSource, /observatoryGuideExpanded: false/)
  assert.match(storeSource, /merged\.selectedInterval = '1d'/)
  assert.match(storeSource, /merged\.observatoryGuideExpanded = false/)
  assert.match(storeSource, /merged\.runtimeDiagnostics = \[\]/)
  assert.doesNotMatch(storeSource, /expandedSections/)
  assert.match(managerSource, /pollInFlight/)
  assert.match(managerSource, /scheduleNextPoll/)
  assert.match(stateHookSource, /runtimeDiagnostics/)
  assert.match(layoutSource, /useObservatoryState/)
  assert.match(layoutSource, /showDiagnostics/)
  assert.match(layoutSource, /obs-diagnostics-panel/)
  assert.match(cssSource, /\.obs-runtime \{/)
  assert.match(cssSource, /\.obs-health-panel \{/)
  assert.match(cssSource, /\.app-crash-shell \{/)
}

function runObservatoryIndicatorHealthTest() {
  const candles = buildObservatoryCandles(280, 100)
  const snapshot = buildObservatorySnapshot({
    coin: 'BTC',
    interval: '1d',
    candles,
  })

  assert.ok(snapshot.indicators.length >= 12, `Expected at least 12 indicators, got ${snapshot.indicators.length}`)
  assert.equal(snapshot.health.total, snapshot.indicators.length)
  assert.ok(snapshot.health.valid >= Math.floor(snapshot.indicators.length * 0.8))
  assert.equal(snapshot.timeline.length, candles.length)
  assert.equal(snapshot.barStates.length, candles.length)
  assert.ok(snapshot.timeline.every((cluster) => cluster.topHits.length <= 3))
  assert.ok(snapshot.timeline.every((cluster) => cluster.events.length === cluster.totalHits))
  assert.ok(snapshot.timeline.every((cluster) => cluster.events.every((event) => event.durationBars >= 1)))
  assert.ok(snapshot.indicators.every((indicator) => indicator.category !== 'Flow'))
  assert.ok(snapshot.barStates.every((bar) => bar.activeIndicatorIds.length === bar.activeCount))

  const cross = snapshot.indicators.find((indicator) => indicator.id === 'event_ema_8_21_cross')
  assert.ok(cross, 'Expected event_ema_8_21_cross indicator to exist')
  assert.ok(snapshot.indicators.every((indicator) => indicator.id.startsWith('event_')), 'All indicators should be event-based')
}

function runObservatoryBooleanStateTest() {
  const candles = buildObservatoryCandles(180, 140)
  const snapshot = buildObservatorySnapshot({
    coin: 'BTC',
    interval: '1d',
    candles,
  })

  const records = buildIndicatorStateRecords(snapshot)
  assert.equal(records.length, snapshot.barStates.length * snapshot.indicators.length)
  assert.ok(records.every((record) => record.category !== 'Flow'))

  const sampleBar = snapshot.barStates[Math.floor(snapshot.barStates.length / 2)]
  const sampleIndicator = snapshot.indicators[Math.floor(snapshot.indicators.length / 3)]
  assert.ok(sampleBar)
  assert.ok(sampleIndicator)

  const sampleRecord = records.find((record) => record.candleTime === sampleBar.time && record.indicatorId === sampleIndicator.id)
  assert.ok(sampleRecord)
  assert.equal(sampleRecord.isOn, sampleBar.activeIndicatorIds.includes(sampleIndicator.id))
}

function runClosedBarPersistenceFilterTest() {
  const candles = buildObservatoryCandles(180, 140)
  const snapshot = buildObservatorySnapshot({
    coin: 'BTC',
    interval: '1d',
    candles,
  })

  const latestBarTime = candles[candles.length - 1]?.time
  assert.ok(typeof latestBarTime === 'number')

  const stillOpenNow = latestBarTime + 12 * 3_600_000
  const closedTimes = getClosedBarTimes(snapshot, stillOpenNow)
  assert.ok(closedTimes.length > 0)
  assert.ok(!closedTimes.includes(latestBarTime))

  const closedRecords = buildClosedIndicatorStateRecords(snapshot, { now: stillOpenNow })
  assert.ok(closedRecords.length > 0)
  assert.ok(closedRecords.every((record) => record.candleTime !== latestBarTime))

  const afterCloseNow = latestBarTime + 25 * 3_600_000
  const afterCloseRecords = buildClosedIndicatorStateRecords(snapshot, { now: afterCloseNow })
  assert.ok(afterCloseRecords.some((record) => record.candleTime === latestBarTime))
}

function runPersistedAnalyticsTest() {
  const candles = buildObservatoryCandles(220, 150)
  const snapshot = buildObservatorySnapshot({
    coin: 'BTC',
    interval: '1d',
    candles,
  })
  const latestCandle = candles[candles.length - 1]
  assert.ok(latestCandle)
  const now = latestCandle.time + 25 * 3_600_000
  const rows = buildClosedIndicatorStateRecords(snapshot, { now })
  const analytics = buildPersistedObservatoryAnalytics({
    coin: 'BTC',
    interval: '1d',
    days: 180,
    rows: rows.map((row) => ({
      candleTime: row.candleTime,
      indicatorId: row.indicatorId,
      category: row.category,
      isOn: row.isOn,
    })),
  })

  assert.equal(analytics.coin, 'BTC')
  assert.equal(analytics.interval, '1d')
  assert.equal(analytics.days, 180)
  assert.ok(analytics.windowBars > 0)
  assert.ok(analytics.totalHits > 0)
  assert.ok(analytics.lastPersistedBarTime !== null)
  assert.ok(analytics.rows.length > 0)
  assert.ok(analytics.categoryRows.length === 5)
  assert.ok(analytics.rows.every((row) => Array.isArray(row.recentHitTimes)))
  assert.ok(analytics.categoryRows.every((row) => Number.isFinite(row.activeRate)))
  assert.ok(analytics.rows.every((row) => Number.isFinite(row.transitionRate)))
}

function runContractInterfaceSourceCheck() {
  const contractsSource = readFileSync(join(__dirname, '../src/contracts/v1.ts'), 'utf8')
  const observatoryApiSource = readFileSync(join(__dirname, '../api/observatory-snapshot.ts'), 'utf8')
  const analyticsApiSource = readFileSync(join(__dirname, '../api/observatory-analytics.ts'), 'utf8')
  const priceContextSource = readFileSync(join(__dirname, '../src/observatory/priceContext.ts'), 'utf8')
  const packageSource = readFileSync(join(__dirname, '../package.json'), 'utf8')

  assert.match(contractsSource, /export const CONTRACT_VERSION_V1 = 'v1'/)
  assert.match(contractsSource, /export interface ContractMetaV1/)
  assert.match(contractsSource, /export type DataSourceV1 = 'derived' \| 'ledger'/)
  assert.match(contractsSource, /export function isDataSourceV1/)
  assert.match(observatoryApiSource, /source: 'derived'/)
  assert.match(analyticsApiSource, /source: 'ledger'/)
  assert.match(observatoryApiSource, /contractVersion: CONTRACT_VERSION_V1/)
  assert.match(analyticsApiSource, /contractVersion: CONTRACT_VERSION_V1/)
  assert.doesNotMatch(priceContextSource, /updatedAt/)
  assert.match(packageSource, /"build:signals"/)
  assert.match(readFileSync(join(__dirname, '../src/hooks/useIndicatorObservatory.ts'), 'utf8'), /state\.candles\[coin\]\[interval\]/)
}

function runObservatoryRemoteResetSourceCheck() {
  const hookSource = readFileSync(join(__dirname, '../src/hooks/useIndicatorObservatory.ts'), 'utf8')
  assert.match(hookSource, /const requestKey = `\$\{coin\}:\$\{observatoryInterval\}`/)
  assert.match(hookSource, /const \[remoteKey, setRemoteKey\] = useState<string \| null>\(null\)/)
  assert.match(hookSource, /setRemoteSnapshot\(null\)/)
  assert.match(hookSource, /setRemotePriceContext\(null\)/)
  assert.match(hookSource, /setRemoteKey\(requestKey\)/)
  assert.match(hookSource, /const hasMatchingRemote = remoteKey === requestKey/)
}

function runClusterResizeSourceCheck() {
  const clusterSource = readFileSync(join(__dirname, '../src/components/observatory/IndicatorClusterLanes.tsx'), 'utf8')
  const cssSource = readFileSync(join(__dirname, '../src/index.css'), 'utf8')
  assert.match(clusterSource, /const \[viewportWidth, setViewportWidth\] = useState/)
  assert.match(clusterSource, /window\.addEventListener\('resize', syncViewportWidth\)/)
  assert.match(clusterSource, /const isNarrowViewport = viewportWidth <= 760/)
  assert.match(clusterSource, /const isFullDailySequence = mode === 'simple' && timeframe === '1d'/)
  assert.match(clusterSource, /if \(mode === 'pro' \|\| isFullDailySequence\) return source/)
  assert.match(clusterSource, /obs-cluster__heatmap--daily-full/)
  assert.match(cssSource, /\.obs-cluster__heatmap--daily-full \{/)
  assert.match(cssSource, /\.obs-cluster__lane--daily-full \{/)
  assert.match(cssSource, /\.obs-cluster__cells--daily-full \{/)
}

function runObservatoryAccessibilitySourceCheck() {
  const layoutSource = readFileSync(join(__dirname, '../src/components/observatory/ObservatoryLayout.tsx'), 'utf8')
  const reportSource = readFileSync(join(__dirname, '../src/components/observatory/CandleReportPage.tsx'), 'utf8')
  assert.match(layoutSource, /aria-controls="obs-diagnostics-detail"/)
  assert.match(layoutSource, /aria-controls="obs-live-chart-panel"/)
  assert.match(reportSource, /aria-label="Previous candle"/)
  assert.match(reportSource, /aria-label="Next candle"/)
  assert.match(reportSource, /aria-controls="obs-report-chart-panel"/)
}

function runObservatoryUtcTimeSourceCheck() {
  const timeFormatSource = readFileSync(join(__dirname, '../src/observatory/timeFormat.ts'), 'utf8')
  const layoutSource = readFileSync(join(__dirname, '../src/components/observatory/ObservatoryLayout.tsx'), 'utf8')
  const reportSource = readFileSync(join(__dirname, '../src/components/observatory/CandleReportPage.tsx'), 'utf8')
  const clusterSource = readFileSync(join(__dirname, '../src/components/observatory/IndicatorClusterLanes.tsx'), 'utf8')
  const analyticsSource = readFileSync(join(__dirname, '../src/components/observatory/AnalyticsPage.tsx'), 'utf8')

  assert.match(timeFormatSource, /timeZone: 'UTC'/)
  assert.match(timeFormatSource, /export function formatUtcDateTime/)
  assert.match(timeFormatSource, /export function formatUtcDate/)
  assert.match(timeFormatSource, /export function formatUtcTime/)
  assert.match(layoutSource, /formatUtcDateTime/)
  const formatSource = readFileSync(join(__dirname, '../src/observatory/format.ts'), 'utf8')
  assert.match(formatSource, /formatUtcTime/)
  assert.match(reportSource, /formatUtcDateTime/)
  assert.match(clusterSource, /formatUtcDateTime/)
  assert.match(analyticsSource, /formatUtcDate/)
  assert.doesNotMatch(layoutSource, /new Date\(.*\)\.toLocaleString/)
  assert.doesNotMatch(layoutSource, /new Date\(.*\)\.toLocaleTimeString/)
  assert.doesNotMatch(reportSource, /new Date\(.*\)\.toLocaleString/)
  assert.doesNotMatch(clusterSource, /new Date\(.*\)\.toLocaleString/)
  assert.doesNotMatch(analyticsSource, /toLocaleDateString/)
}

function runObservatoryPersistenceSourceCheck() {
  const persistenceSource = readFileSync(join(__dirname, '../src/observatory/persistence.ts'), 'utf8')
  const persistRouteSource = readFileSync(join(__dirname, '../api/persist-observatory-states.ts'), 'utf8')
  const backfillRouteSource = readFileSync(join(__dirname, '../api/backfill-observatory-states.ts'), 'utf8')
  const persistenceHelperSource = readFileSync(join(__dirname, '../api/_observatoryPersistence.ts'), 'utf8')
  const observatoryApiSource = readFileSync(join(__dirname, '../api/observatory-snapshot.ts'), 'utf8')
  const vercelSource = readFileSync(join(__dirname, '../vercel.json'), 'utf8')
  const parityChecklistSource = readFileSync(join(__dirname, '../docs/production-parity-checklist.md'), 'utf8')
  const engineeringMapSource = readFileSync(join(__dirname, '../docs/engineering-map.md'), 'utf8')

  assert.match(persistenceSource, /export function getClosedBarTimes/)
  assert.match(persistenceSource, /export function buildClosedIndicatorStateRecords/)
  assert.match(persistenceSource, /time \+ intervalMs <= now/)
  assert.match(persistRouteSource, /isTrustedCronRequest/)
  assert.match(persistRouteSource, /mode: isCronRequest \? 'cron' : 'manual'/)
  assert.match(persistRouteSource, /method !== 'POST' && !isCronRequest/)
  assert.match(persistRouteSource, /CRON_PERSISTENCE_DAYS/)
  assert.match(backfillRouteSource, /mode: 'backfill'/)
  assert.match(backfillRouteSource, /DEFAULT_BACKFILL_DAYS = 180/)
  assert.match(persistenceHelperSource, /OBSERVATORY_PERSIST_SECRET/)
  assert.match(persistenceHelperSource, /CRON_SECRET/)
  assert.match(persistenceHelperSource, /buildClosedIndicatorStateRecords/)
  assert.match(persistenceHelperSource, /observatory_indicator_states\?on_conflict=id/)
  assert.match(persistenceHelperSource, /rule_version: OBSERVATORY_RULESET_VERSION/)
  assert.doesNotMatch(persistenceHelperSource, /querySecret/)
  assert.doesNotMatch(observatoryApiSource, /persistObservatoryLookback|observatory_indicator_states/)
  assert.match(vercelSource, /"path": "\/api\/persist-observatory-states"/)
  assert.match(vercelSource, /"schedule": "15 2 \* \* \*"/)
  assert.match(parityChecklistSource, /api\/persist-observatory-states\.ts/)
  assert.match(parityChecklistSource, /api\/backfill-observatory-states\.ts/)
  assert.match(parityChecklistSource, /rule_version/)
  assert.match(engineeringMapSource, /Secret-gated cron writer/)
  assert.match(engineeringMapSource, /Secret-gated manual backfill route/)
  assert.match(engineeringMapSource, /rule_version/)
}

function runObservatoryAnalyticsSourceCheck() {
  const analyticsPageSource = readFileSync(join(__dirname, '../src/components/observatory/AnalyticsPage.tsx'), 'utf8')
  const analyticsModuleSource = readFileSync(join(__dirname, '../src/observatory/analytics.ts'), 'utf8')
  const analyticsApiSource = readFileSync(join(__dirname, '../api/observatory-analytics.ts'), 'utf8')
  const analyticsHelperSource = readFileSync(join(__dirname, '../api/_observatoryAnalytics.ts'), 'utf8')
  const parityChecklistSource = readFileSync(join(__dirname, '../docs/production-parity-checklist.md'), 'utf8')
  const engineeringMapSource = readFileSync(join(__dirname, '../docs/engineering-map.md'), 'utf8')

  assert.match(analyticsPageSource, /new URLSearchParams/)
  assert.match(analyticsPageSource, /buildSnapshotAnalytics/)
  assert.match(analyticsPageSource, /Live window fallback/)
  assert.match(analyticsPageSource, /LEDGER_LOOKBACK_DAYS = 180/)
  assert.match(analyticsPageSource, /analytics\.days\}d ledger/)
  assert.match(analyticsPageSource, /persisted\?\.transitionRate \?\? indicator\.frequency\.stateTransitionRate/)
  assert.match(analyticsModuleSource, /export function buildPersistedObservatoryAnalytics/)
  assert.match(analyticsModuleSource, /export function buildSnapshotAnalytics/)
  assert.match(analyticsModuleSource, /transitionRate/)
  assert.match(analyticsApiSource, /loadPersistedObservatoryAnalytics/)
  assert.match(analyticsApiSource, /days = parsePositiveInteger/)
  assert.match(analyticsApiSource, /source: 'ledger'/)
  assert.match(analyticsHelperSource, /from '\.\/_signals\.mjs'/)
  assert.match(analyticsHelperSource, /observatory_indicator_states/)
  assert.match(analyticsHelperSource, /params\.set\('limit', String\(READ_BATCH_SIZE\)\)/)
  assert.match(analyticsHelperSource, /params\.set\('offset', String\(from\)\)/)
  assert.match(parityChecklistSource, /api\/observatory-analytics\.ts/)
  assert.match(engineeringMapSource, /Read-only analytics route backed by `observatory_indicator_states`/)
}

function assertIndicatorRange(values, minExpected, maxExpected, tolerance = 0) {
  assert.ok(values.length > 0)
  const min = Math.min(...values)
  const max = Math.max(...values)
  assert.ok(min >= minExpected - tolerance, `Expected min >= ${minExpected}, got ${min}`)
  assert.ok(max <= maxExpected + tolerance, `Expected max <= ${maxExpected}, got ${max}`)
}

function buildObservatoryCandles(count, startPrice) {
  const start = Date.UTC(2026, 0, 1, 0, 0, 0)
  const result = []
  let previousClose = startPrice

  for (let index = 0; index < count; index += 1) {
    const drift = Math.sin(index / 8) * 0.9 + Math.cos(index / 21) * 0.45 + index * 0.006
    const close = previousClose + drift
    const open = previousClose
    const high = Math.max(open, close) + 0.55 + Math.sin(index / 11) * 0.12
    const low = Math.min(open, close) - 0.55 - Math.cos(index / 14) * 0.11
    const volume = 1200 + Math.sin(index / 6) * 220 + index * 1.3
    const trades = 480 + Math.cos(index / 5) * 60 + index * 0.45

    result.push({
      time: start + index * 24 * 3_600_000,
      open,
      high,
      low,
      close,
      volume,
      trades,
    })
    previousClose = close
  }

  return result
}

function runBundleDriftCheck() {
  checkBundle('_signals', signals, join(__dirname, '../api/_signals.d.mts'))
}

function checkBundle(name, mod, declPath) {
  const decl = readFileSync(declPath, 'utf8')
  const declared = [...decl.matchAll(/export\s+function\s+(\w+)/g)].map((match) => match[1])

  const missing = declared.filter((fn) => typeof mod[fn] !== 'function')
  if (missing.length > 0) {
    throw new Error(`Bundle drift: ${name}.d.mts declares functions missing from ${name}.mjs: ${missing.join(', ')}`)
  }
}

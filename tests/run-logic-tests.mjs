import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const signals = await import('../api/_signals.mjs')
const {
  resolveSetupWindow,
  computeOIDelta,
  computeProvisionalSetup,
  computePositionPolicy,
  computeSuggestedPositionComposition,
  deriveCompositionRiskStatus,
  computeSetupMetrics,
  buildClosedIndicatorStateRecords,
  buildIndicatorStateRecords,
  buildObservatorySnapshot,
  getClosedBarTimes,
} = signals

runResolveOutcomeTest()
runSettlementBoundaryTests()
runOiDeltaTest()
runBuildSetupIdExportTest()
runProvisionalSetupGateTest()
runPositionPolicyTest()
runSuggestedPositionCompositionTest()
runObservatoryRuntimeSourceCheck()
runObservatoryApiBundlingSourceCheck()
runObservatoryShellSourceCheck()
runObservatoryCleanupSourceCheck()
runRuntimeStabilitySourceCheck()
runObservatoryIndicatorHealthTest()
runObservatoryBooleanStateTest()
runClosedBarPersistenceFilterTest()
runDeterministicReplayCheck()
runContractInterfaceSourceCheck()
runObservatoryRemoteResetSourceCheck()
runClusterResizeSourceCheck()
runObservatoryAccessibilitySourceCheck()
runObservatoryPersistenceSourceCheck()
runObservatoryAnalyticsSourceCheck()
runBundleDriftCheck()

console.log('Logic regression checks passed')

function runResolveOutcomeTest() {
  const setup = {
    coin: 'BTC',
    direction: 'long',
    entryPrice: 100,
    stopPrice: 90,
    targetPrice: 130,
    meanTargetPrice: 115,
    suggestedLeverage: 1,
    suggestedPositionSize: 1000,
    confidence: 0.7,
    confidenceTier: 'medium',
    regime: 'mean-reverting',
    entryQuality: 'ideal',
    summary: 'test',
    generatedAt: Date.UTC(2026, 2, 2, 21, 0, 1, 41),
    source: 'server',
  }

  const candles = [
    candle(Date.UTC(2026, 2, 2, 21), 100, 101, 99, 101),
    candle(Date.UTC(2026, 2, 2, 22), 101, 102, 100, 102),
    candle(Date.UTC(2026, 2, 2, 23), 102, 103, 101, 103),
    candle(Date.UTC(2026, 2, 3, 0), 103, 104, 102, 104),
    candle(Date.UTC(2026, 2, 3, 1), 104, 105, 103, 105),
    candle(Date.UTC(2026, 2, 3, 2), 105, 106, 104, 106),
  ]

  const outcome = resolveSetupWindow(setup, '4h', candles, Date.UTC(2026, 2, 3, 2, 5, 0))
  assert.ok(outcome)
  assert.equal(outcome.priceAtResolution, 105)
  assert.equal(outcome.result, 'expired')
  assert.equal(outcome.coverageStatus, 'full')
  assert.equal(outcome.candleCountUsed, 5)
}

function runSettlementBoundaryTests() {
  const generatedAt = Date.UTC(2026, 2, 2, 10, 17, 0)
  const setup = {
    coin: 'BTC',
    direction: 'long',
    entryPrice: 100,
    stopPrice: 90,
    targetPrice: 130,
    meanReversionTarget: 110,
    suggestedLeverage: 2,
    suggestedPositionSize: 1000,
    confidence: 0.7,
    confidenceTier: 'medium',
    regime: 'mean-reverting',
    entryQuality: 'ideal',
    rrRatio: 3,
    reversionPotential: 0.75,
    stretchSigma: 2.1,
    atr: 2,
    compositeValue: 0.4,
    timeframe: '24-72h',
    summary: '72h check',
    generatedAt,
    source: 'server',
  }

  const targetTime = generatedAt + 72 * 60 * 60 * 1000
  const beforeDeadline = resolveSetupWindow(setup, '72h', [], targetTime - 1)
  assert.equal(beforeDeadline, null)

  const missingCoverageCandles = buildFlatCandles(Date.UTC(2026, 2, 2, 10), 70, 100)
  const withinGrace = resolveSetupWindow(setup, '72h', missingCoverageCandles, targetTime + 60 * 60 * 1000)
  assert.equal(withinGrace, null)

  const afterGrace = resolveSetupWindow(setup, '72h', missingCoverageCandles, targetTime + 25 * 60 * 60 * 1000)
  assert.ok(afterGrace)
  assert.equal(afterGrace.result, 'unresolvable')
  assert.equal(afterGrace.coverageStatus, 'insufficient')

  const fullCoverageCandles = buildFlatCandles(Date.UTC(2026, 2, 2, 10), 73, 101)
  const resolved = resolveSetupWindow(setup, '72h', fullCoverageCandles, targetTime + 5 * 60 * 1000)
  assert.ok(resolved)
  assert.equal(resolved.result, 'expired')
  assert.equal(resolved.coverageStatus, 'full')
}

function runOiDeltaTest() {
  const closes = [100, 101, 102, 103, 104, 105]
  const rawHistory = [
    snapshot(Date.UTC(2026, 2, 2, 0, 5), 1000),
    snapshot(Date.UTC(2026, 2, 2, 0, 55), 1010),
    snapshot(Date.UTC(2026, 2, 2, 1, 5), 1020),
    snapshot(Date.UTC(2026, 2, 2, 1, 55), 1030),
    snapshot(Date.UTC(2026, 2, 2, 2, 5), 1040),
    snapshot(Date.UTC(2026, 2, 2, 2, 55), 1050),
    snapshot(Date.UTC(2026, 2, 2, 3, 5), 1060),
    snapshot(Date.UTC(2026, 2, 2, 3, 55), 1070),
    snapshot(Date.UTC(2026, 2, 2, 4, 5), 1080),
    snapshot(Date.UTC(2026, 2, 2, 4, 55), 1090),
    snapshot(Date.UTC(2026, 2, 2, 5, 5), 1100),
    snapshot(Date.UTC(2026, 2, 2, 5, 55), 1110),
  ]

  const hourlyHistory = [
    snapshot(Date.UTC(2026, 2, 2, 0), 1010),
    snapshot(Date.UTC(2026, 2, 2, 1), 1030),
    snapshot(Date.UTC(2026, 2, 2, 2), 1050),
    snapshot(Date.UTC(2026, 2, 2, 3), 1070),
    snapshot(Date.UTC(2026, 2, 2, 4), 1090),
    snapshot(Date.UTC(2026, 2, 2, 5), 1110),
  ]

  const rawResult = computeOIDelta(rawHistory, closes)
  const hourlyResult = computeOIDelta(hourlyHistory, closes)
  assert.deepEqual(rawResult, hourlyResult)
}

function runBuildSetupIdExportTest() {
  const key = signals.buildSetupId({
    coin: 'BTC',
    direction: 'long',
    generatedAt: 1234567890,
    entryPrice: 100.123456,
    stopPrice: 95.5,
    targetPrice: 110.987654,
  })

  assert.equal(key, 'setup:BTC:long:1234567890:100.1235:95.5:110.9877')
}

function runProvisionalSetupGateTest() {
  const trendingSignals = buildSignals({
    hurst: { value: 0.72, regime: 'trending' },
    composite: { direction: 'long', strength: 'moderate' },
    entryGeometry: { directionBias: 'long', entryQuality: 'extended' },
  })

  const blocked = computeProvisionalSetup('BTC', trendingSignals, 100)
  assert.equal(blocked, null)

  const validSignals = buildSignals({
    hurst: { value: 0.42, regime: 'mean-reverting' },
    composite: { direction: 'long', strength: 'moderate', agreementCount: 3, agreementTotal: 4, value: 0.42 },
    entryGeometry: { directionBias: 'long', entryQuality: 'extended', reversionPotential: 0.7 },
  })

  const provisional = computeProvisionalSetup('BTC', validSignals, 100)
  assert.ok(provisional)
  assert.equal(provisional.direction, 'long')
  assert.equal(provisional.entryQuality, 'extended')

  const metrics = computeSetupMetrics(validSignals, { confidenceScale: 0.55, confidenceCap: 0.55 })
  assert.equal(provisional.confidenceTier, metrics.confidenceTier)
  assert.equal(provisional.confidence, metrics.confidence)
  assert.equal(provisional.timeframe, metrics.timeframe)

  const noEdgeSignals = buildSignals({
    composite: { direction: 'long', strength: 'moderate' },
    entryGeometry: { directionBias: 'long', entryQuality: 'no-edge' },
  })
  assert.equal(computeProvisionalSetup('BTC', noEdgeSignals, 100), null)
}

function runPositionPolicyTest() {
  const validatedSetup = {
    coin: 'BTC',
    direction: 'long',
    entryPrice: 100,
    stopPrice: 95,
    targetPrice: 110,
    meanReversionTarget: 106,
    rrRatio: 2,
    suggestedPositionSize: 1000,
    suggestedLeverage: 5.5,
    tradeGrade: 'green',
    confidence: 0.72,
    confidenceTier: 'high',
    entryQuality: 'ideal',
    agreementCount: 4,
    agreementTotal: 4,
    regime: 'mean-reverting',
    reversionPotential: 0.8,
    stretchSigma: 2.3,
    atr: 2,
    compositeValue: 0.45,
    timeframe: '4-24h',
    summary: 'validated',
    generatedAt: Date.now(),
  }

  const provisionalSetup = {
    ...validatedSetup,
    confidence: 0.42,
    confidenceTier: 'medium',
    entryQuality: 'extended',
    suggestedLeverage: 3.4,
    summary: 'provisional',
  }

  const validated = computePositionPolicy(validatedSetup, 'validated', 10_000)
  const provisional = computePositionPolicy(provisionalSetup, 'provisional', 10_000)

  assert.ok(validated.capitalFractionCap < 1)
  assert.ok(validated.targetRiskPct > provisional.targetRiskPct)
  assert.ok(validated.capitalFractionCap > provisional.capitalFractionCap)
  assert.ok(validated.leverage <= 6)
  assert.ok(provisional.leverage <= 2.5)
  assert.ok(validated.marginUsd > provisional.marginUsd)
  assert.ok(validated.marginUsd <= 10_000 * validated.capitalFractionCap)
  assert.ok(provisional.marginUsd <= 10_000 * provisional.capitalFractionCap)
  assert.notEqual(validated.capitalFractionCap, 1)
  assert.notEqual(provisional.capitalFractionCap, 0.35)

  const validatedMetrics = computeSetupMetrics(buildSignals({
    composite: { agreementCount: 4, agreementTotal: 4, value: 0.42 },
    entryGeometry: { entryQuality: 'ideal', reversionPotential: 0.8 },
    hurst: { confidence: 0.9, regime: 'mean-reverting' },
  }))
  assert.equal(validatedMetrics.timeframe, '4-24h')
  assert.equal(validatedMetrics.confidenceTier, 'high')
}

function runSuggestedPositionCompositionTest() {
  const composition = computeSuggestedPositionComposition({
    coin: 'BTC',
    accountSize: 10_000,
    currentPrice: 100,
    signals: buildSignals(),
  })

  assert.equal(composition.mode, 'validated')
  assert.equal(composition.status, 'ready')
  assert.ok(composition.outputs)
  assert.equal(deriveCompositionRiskStatus(composition), 'safe')

  const noCapitalComposition = computeSuggestedPositionComposition({
    coin: 'BTC',
    accountSize: 0,
    currentPrice: 100,
    signals: buildSignals(),
  })

  assert.equal(noCapitalComposition.status, 'invalid')
  assert.equal(deriveCompositionRiskStatus(noCapitalComposition), 'unknown')
}

function runObservatoryRuntimeSourceCheck() {
  const managerSource = readFileSync(join(__dirname, '../src/services/dataManager.ts'), 'utf8')
  const dataHookSource = readFileSync(join(__dirname, '../src/hooks/useDataManager.ts'), 'utf8')
  const engineeringMapSource = readFileSync(join(__dirname, '../docs/engineering-map.md'), 'utf8')
  const parityChecklistSource = readFileSync(join(__dirname, '../docs/production-parity-checklist.md'), 'utf8')

  assert.match(managerSource, /fetchAllMids/)
  assert.match(managerSource, /fetchCandles/)
  assert.match(managerSource, /HyperliquidWS/)
  assert.match(managerSource, /scheduleNextPoll/)
  assert.match(managerSource, /runPollingCycle/)
  assert.match(managerSource, /executePollingCycle/)
  assert.doesNotMatch(managerSource, /fetchServerSetups|fetchCollectorHeartbeatStatus|fetchExecutionEvents|uploadLocalSetups/)
  assert.doesNotMatch(managerSource, /fetchFundingHistory|fetchFearGreed|fetchCoinGeckoGlobal|fetchBinanceFundingRate|fetchBinanceOpenInterest/)
  assert.match(dataHookSource, /computeAllSignals/)
  assert.doesNotMatch(dataHookSource, /trackAllDecisionSnapshots|resolveSetupOutcomes|resolveTrackedOutcomes|pruneTrackerHistory/)
  assert.match(engineeringMapSource, /current mounted product: the live observatory shell/i)
  assert.match(engineeringMapSource, /Removed legacy architecture/i)
  assert.match(parityChecklistSource, /api\/observatory-snapshot\.ts/)
  assert.match(parityChecklistSource, /observatory_indicator_states/)
  assert.doesNotMatch(parityChecklistSource, /tracked_signals|server_setups|collector_heartbeat/)
}

function runObservatoryApiBundlingSourceCheck() {
  const observatoryApiSource = readFileSync(join(__dirname, '../api/observatory-snapshot.ts'), 'utf8')

  assert.match(observatoryApiSource, /from '\.\/_signals\.mjs'/)
  assert.doesNotMatch(observatoryApiSource, /from '\.\.\/src\/observatory\/engine'/)
}

function runObservatoryShellSourceCheck() {
  const layoutSource = readFileSync(join(__dirname, '../src/components/observatory/ObservatoryLayout.tsx'), 'utf8')
  const analyticsSource = readFileSync(join(__dirname, '../src/components/observatory/AnalyticsPage.tsx'), 'utf8')
  const reportSource = readFileSync(join(__dirname, '../src/components/observatory/CandleReportPage.tsx'), 'utf8')
  const clusterSource = readFileSync(join(__dirname, '../src/components/observatory/IndicatorClusterLanes.tsx'), 'utf8')
  const guideStripSource = readFileSync(join(__dirname, '../src/components/observatory/ObservatoryGuideStrip.tsx'), 'utf8')
  const methodologySource = readFileSync(join(__dirname, '../src/components/observatory/MethodologyPage.tsx'), 'utf8')
  const methodologyContentSource = readFileSync(join(__dirname, '../src/components/observatory/methodologyContent.ts'), 'utf8')
  const observatoryHookSource = readFileSync(join(__dirname, '../src/hooks/useIndicatorObservatory.ts'), 'utf8')
  const routerSource = readFileSync(join(__dirname, '../src/hooks/useHashRouter.ts'), 'utf8')
  const cssSource = readFileSync(join(__dirname, '../src/index.css'), 'utf8')

  assert.match(layoutSource, /data-testid="obs-shell"/)
  assert.match(layoutSource, /data-testid="obs-command-bar"/)
  assert.match(layoutSource, /data-testid="obs-price-strip"/)
  assert.match(layoutSource, /data-testid="obs-live-status"/)
  assert.match(layoutSource, /data-testid="obs-diagnostics-toggle"/)
  assert.match(layoutSource, /data-testid="obs-nav-observatory"/)
  assert.match(layoutSource, /data-testid="obs-nav-analytics"/)
  assert.match(layoutSource, /data-testid="obs-nav-methodology"/)
  assert.match(layoutSource, /<IndicatorClusterLanes/)
  assert.match(layoutSource, /<CandleReportPage/)
  assert.match(layoutSource, /<AnalyticsPage/)
  assert.match(layoutSource, /<MethodologyPage/)
  assert.match(layoutSource, /navigateToReport/)
  assert.match(layoutSource, /navigateToHeatmap/)
  assert.match(layoutSource, /navigateToAnalytics/)
  assert.match(layoutSource, /navigateToMethodology/)
  assert.match(layoutSource, /data-testid="obs-view-network"/)
  assert.match(layoutSource, /data-testid="obs-mode-advanced"/)
  assert.match(layoutSource, /data-testid="obs-cluster-mode-pro"/)
  assert.match(layoutSource, /data-testid="obs-selected-cluster-open-report"/)
  assert.match(analyticsSource, /data-testid="obs-analytics-page"/)
  assert.match(analyticsSource, /data-testid="obs-analytics-table"/)
  assert.match(analyticsSource, /data-testid="obs-analytics-inspector"/)
  assert.match(analyticsSource, /data-testid="obs-analytics-source"/)
  assert.match(methodologySource, /data-testid="obs-methodology-page"/)
  assert.match(methodologySource, /data-testid="obs-methodology-flow"/)
  assert.match(methodologySource, /data-testid="obs-methodology-pages"/)
  assert.match(methodologySource, /data-testid="obs-methodology-live"/)
  assert.match(methodologySource, /data-testid="obs-methodology-workflow"/)
  assert.doesNotMatch(methodologySource, /How to know what you can trust/)
  assert.doesNotMatch(methodologyContentSource, /Canonical vs local|How recent the canonical snapshot is|category: 'Flow'/)
  assert.match(reportSource, /data-testid="obs-candle-report-page"/)
  assert.match(reportSource, /data-testid="obs-candle-report-back"/)
  assert.match(reportSource, /data-testid="obs-candle-report-prev"/)
  assert.match(reportSource, /data-testid="obs-candle-report-next"/)
  assert.match(reportSource, /data-testid="obs-cluster-report"/)
  assert.match(reportSource, /data-testid="obs-report-metrics"/)
  assert.match(reportSource, /data-testid="obs-report-active-context"/)
  assert.match(reportSource, /data-testid="obs-report-category-share"/)
  assert.match(clusterSource, /data-testid="obs-cluster-lanes"/)
  assert.match(clusterSource, /data-testid="obs-cluster-cell"/)
  assert.match(guideStripSource, /data-testid="obs-guide-strip"/)
  assert.match(observatoryHookSource, /export type ObservatoryLiveStatus = 'live' \| 'updating' \| 'delayed' \| 'disconnected'/)
  assert.match(observatoryHookSource, /fundingHistory: \[\]/)
  assert.match(observatoryHookSource, /oiHistory: \[\]/)
  assert.doesNotMatch(observatoryHookSource, /const fundingHistory = useStore|const oiHistory = useStore/)
  assert.match(routerSource, /#\/observatory/)
  assert.match(routerSource, /#\/observatory\/report/)
  assert.match(routerSource, /#\/analytics/)
  assert.match(routerSource, /#\/methodology/)
  assert.match(cssSource, /\.obs-command-bar \{/)
  assert.match(cssSource, /\.obs-guide \{/)
  assert.match(cssSource, /\.obs-methodology \{/)
  assert.match(cssSource, /\.obs-live-status \{/)
  assert.match(cssSource, /\.obs-diagnostics-panel \{/)
  assert.match(cssSource, /\.obs-global-header \{/)
  assert.match(cssSource, /\.obs-analytics \{/)
  assert.match(cssSource, /\.obs-report__metrics \{/)
  assert.match(cssSource, /\.obs-report__insights \{/)
  assert.doesNotMatch(layoutSource, /source === 'canonical'/)
  assert.match(cssSource, /\.obs-timeline-stack \{/)
  assert.match(cssSource, /\.obs-grid \{/)
}

function runObservatoryCleanupSourceCheck() {
  const storeSource = readFileSync(join(__dirname, '../src/store/index.ts'), 'utf8')
  const uiSliceSource = readFileSync(join(__dirname, '../src/store/uiSlice.ts'), 'utf8')
  const apiClientSource = readFileSync(join(__dirname, '../src/services/api.ts'), 'utf8')
  const packageSource = readFileSync(join(__dirname, '../package.json'), 'utf8')
  const auditSource = readFileSync(join(__dirname, '../audits/observatory-first-codebase-review-2026-03-09.md'), 'utf8')

  const removedFiles = [
    '../src/store/setupSlice.ts',
    '../src/store/trackerSlice.ts',
    '../api/server-setups.ts',
    '../api/signal-accuracy.ts',
    '../api/collector-heartbeat.ts',
    '../api/upload-setups.ts',
    '../api/events/stream.ts',
    '../api/compute-signals.ts',
    '../api/_collector.mjs',
    '../src/server/collector/runCollector.ts',
    '../src/components/setup/SetupCard.tsx',
    '../src/components/market/MarketRail.tsx',
    '../src/components/signal/SignalSection.tsx',
    '../src/components/risk/RiskSection.tsx',
    '../src/components/tracker/AccuracyPanel.tsx',
    '../src/hooks/useServerTrackerStats.ts',
    '../src/hooks/useTrackerStats.ts',
    '../src/hooks/useEntryReadiness.ts',
    '../src/signals/trackerLogic.ts',
    '../src/signals/trackerStats.ts',
    '../supabase/server_setups.sql',
    '../supabase/tracked_signals.sql',
    '../supabase/collector_heartbeat.sql',
  ]

  for (const relativePath of removedFiles) {
    assert.equal(existsSync(join(__dirname, relativePath)), false, `${relativePath} should have been removed`)
  }

  assert.doesNotMatch(storeSource, /createSetupSlice|createTrackerSlice|localTrackedSetups|trackedSignals|trackedOutcomes|serverTrackedSetups/)
  assert.doesNotMatch(uiSliceSource, /canonicalFreshness|signalAccuracyFreshness|collectorFreshness|eventStreamStatus|executionEvents/)
  assert.match(apiClientSource, /export async function fetchAllMids/)
  assert.match(apiClientSource, /export async function fetchCandles/)
  assert.doesNotMatch(apiClientSource, /fetchServerSetups|fetchSignalAccuracy|fetchCollectorHeartbeat|fetchExecutionEvents|fetchPortfolioSnapshot|fetchBacktestResult/)
  assert.doesNotMatch(packageSource, /build:api-collector|build:collector|collector:once|collector:start|repair:server-outcomes/)
  assert.match(auditSource, /Legacy architecture removed/)
  assert.match(auditSource, /observatory_indicator_states/)
}

function runRuntimeStabilitySourceCheck() {
  const appSource = readFileSync(join(__dirname, '../src/App.tsx'), 'utf8')
  const mainSource = readFileSync(join(__dirname, '../src/main.tsx'), 'utf8')
  const uiSliceSource = readFileSync(join(__dirname, '../src/store/uiSlice.ts'), 'utf8')
  const storeSource = readFileSync(join(__dirname, '../src/store/index.ts'), 'utf8')
  const managerSource = readFileSync(join(__dirname, '../src/services/dataManager.ts'), 'utf8')
  const layoutSource = readFileSync(join(__dirname, '../src/components/observatory/ObservatoryLayout.tsx'), 'utf8')
  const cssSource = readFileSync(join(__dirname, '../src/index.css'), 'utf8')

  assert.match(appSource, /AppErrorBoundary/)
  assert.match(appSource, /<AppErrorBoundary>/)
  assert.match(appSource, /ObservatoryLayout/)
  assert.match(mainSource, /window\.addEventListener\('error'/)
  assert.match(mainSource, /window\.addEventListener\('unhandledrejection'/)
  assert.match(mainSource, /__levtradeRuntimeHooksInstalled/)
  assert.match(uiSliceSource, /runtimeDiagnostics/)
  assert.match(uiSliceSource, /pushRuntimeDiagnostic/)
  assert.match(uiSliceSource, /selectedInterval: '4h'/)
  assert.match(storeSource, /delete merged\.expandedSections\['menu'\]/)
  assert.match(storeSource, /merged\.selectedInterval = '4h'/)
  assert.match(storeSource, /merged\.runtimeDiagnostics = \[\]/)
  assert.match(managerSource, /pollInFlight/)
  assert.match(managerSource, /scheduleNextPoll/)
  assert.match(managerSource, /runPollingCycle/)
  assert.match(managerSource, /executePollingCycle/)
  assert.match(managerSource, /this\.pollStopped = true/)
  assert.match(layoutSource, /runtimeDiagnostics/)
  assert.match(layoutSource, /showDiagnostics/)
  assert.match(layoutSource, /obs-diagnostics-panel/)
  assert.match(cssSource, /\.obs-runtime \{/)
  assert.match(cssSource, /\.obs-health-panel \{/)
  assert.match(cssSource, /\.obs-diagnostics-panel \{/)
  assert.match(cssSource, /\.app-crash-shell \{/)
}

function runObservatoryIndicatorHealthTest() {
  const candles = buildObservatoryCandles(280, 100)

  const snapshot = buildObservatorySnapshot({
    coin: 'BTC',
    interval: '4h',
    candles,
    fundingHistory: [],
    oiHistory: [],
  })

  assert.ok(snapshot.indicators.length >= 30)
  assert.equal(snapshot.health.total, snapshot.indicators.length)
  assert.ok(snapshot.health.valid >= Math.floor(snapshot.indicators.length * 0.8))
  assert.equal(snapshot.timeline.length, candles.length)
  assert.equal(snapshot.barStates.length, candles.length)
  assert.ok(snapshot.timeline.every((cluster) => cluster.topHits.length <= 3))
  assert.ok(snapshot.timeline.every((cluster) => cluster.events.length === cluster.totalHits))
  assert.ok(snapshot.timeline.every((cluster) => Number.isFinite(cluster.price.open) && Number.isFinite(cluster.price.close)))
  assert.ok(snapshot.timeline.every((cluster) => cluster.events.every((event) => event.durationBars >= 1)))
  assert.ok(snapshot.timeline.every((cluster) => cluster.events.every((event) => event.durationMs === event.durationBars * 4 * 3_600_000)))
  assert.ok(snapshot.timeline.every((cluster) => cluster.events.every((event) => event.category && event.indicatorLabel)))
  assert.ok(snapshot.indicators.every((indicator) => indicator.category !== 'Flow'))
  assert.ok(snapshot.barStates.every((bar) => bar.activeIndicatorIds.length === bar.activeCount))

  const priceChangeOneBar = snapshot.indicators.find((indicator) => indicator.id === 'momentum_price_change_1h')
  assert.ok(priceChangeOneBar)
  assert.equal(priceChangeOneBar.label, 'Price Change 1 Bar')

  const roc24Bars = snapshot.indicators.find((indicator) => indicator.id === 'momentum_roc_24')
  assert.ok(roc24Bars)
  assert.equal(roc24Bars.label, 'ROC 24 Bars')

  const rsi = snapshot.indicators.find((indicator) => indicator.id === 'momentum_rsi14')
  const donchian = snapshot.indicators.find((indicator) => indicator.id === 'structure_donchian_pos_20')
  assert.ok(rsi)
  assert.ok(donchian)
  assertIndicatorRange(rsi.series.map((point) => point.value), 0, 100, 1e-3)
  assertIndicatorRange(donchian.series.map((point) => point.value), 0, 1, 1e-3)
}

function runObservatoryBooleanStateTest() {
  const candles = buildObservatoryCandles(180, 140)
  const snapshot = buildObservatorySnapshot({
    coin: 'BTC',
    interval: '4h',
    candles,
    fundingHistory: [],
    oiHistory: [],
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
    interval: '4h',
    candles,
    fundingHistory: [],
    oiHistory: [],
  })

  const latestBarTime = candles[candles.length - 1]?.time
  assert.ok(typeof latestBarTime === 'number')

  const stillOpenNow = latestBarTime + 2 * 3_600_000
  const closedTimes = getClosedBarTimes(snapshot, stillOpenNow)
  assert.ok(closedTimes.length > 0)
  assert.ok(!closedTimes.includes(latestBarTime))

  const closedRecords = buildClosedIndicatorStateRecords(snapshot, { now: stillOpenNow })
  assert.ok(closedRecords.length > 0)
  assert.ok(closedRecords.every((record) => record.candleTime !== latestBarTime))

  const afterCloseNow = latestBarTime + 5 * 3_600_000
  const afterCloseRecords = buildClosedIndicatorStateRecords(snapshot, { now: afterCloseNow })
  assert.ok(afterCloseRecords.some((record) => record.candleTime === latestBarTime))
}

function runDeterministicReplayCheck() {
  const candles = buildReplayCandles(140, 100)
  const funding = candles.map((candle, index) => ({
    time: candle.time,
    rate: Math.sin(index / 10) * 0.0002,
  }))
  const oi = candles.map((candle, index) => ({
    time: candle.time,
    oi: 1_000_000 + index * 1_500 + Math.cos(index / 9) * 500,
  }))

  const checkpoints = candles.slice(110, 130).map((candle) => candle.time)
  const firstPass = runReplayPass(candles, funding, oi, checkpoints)
  const secondPass = runReplayPass(candles, funding, oi, checkpoints)

  assert.deepEqual(firstPass, secondPass)
}

function runContractInterfaceSourceCheck() {
  const contractsSource = readFileSync(join(__dirname, '../src/contracts/v1.ts'), 'utf8')
  const observatoryApiSource = readFileSync(join(__dirname, '../api/observatory-snapshot.ts'), 'utf8')
  const packageSource = readFileSync(join(__dirname, '../package.json'), 'utf8')

  assert.match(contractsSource, /export const CONTRACT_VERSION_V1 = 'v1'/)
  assert.match(contractsSource, /export interface ContractMetaV1/)
  assert.match(contractsSource, /export type DataSourceV1 = 'canonical' \| 'fallback' \| 'collector' \| 'local' \| 'derived'/)
  assert.doesNotMatch(contractsSource, /ExecutionEventV1|BacktestResultV1|LivePerformanceSnapshotV1/)
  assert.match(observatoryApiSource, /contractVersion: CONTRACT_VERSION_V1/)
  assert.match(packageSource, /"build:signals"/)
}

function runObservatoryRemoteResetSourceCheck() {
  const hookSource = readFileSync(join(__dirname, '../src/hooks/useIndicatorObservatory.ts'), 'utf8')
  assert.match(hookSource, /const requestKey = `\$\{coin\}:\$\{canonicalInterval\}`/)
  assert.match(hookSource, /const \[remoteKey, setRemoteKey\] = useState<string \| null>\(null\)/)
  assert.match(hookSource, /setRemoteSnapshot\(null\)/)
  assert.match(hookSource, /setRemotePriceContext\(null\)/)
  assert.match(hookSource, /setRemoteKey\(requestKey\)/)
  assert.match(hookSource, /const hasMatchingRemote = remoteKey === requestKey/)
}

function runClusterResizeSourceCheck() {
  const clusterSource = readFileSync(join(__dirname, '../src/components/observatory/IndicatorClusterLanes.tsx'), 'utf8')
  assert.match(clusterSource, /const \[viewportWidth, setViewportWidth\] = useState/)
  assert.match(clusterSource, /window\.addEventListener\('resize', syncViewportWidth\)/)
  assert.match(clusterSource, /const isNarrowViewport = viewportWidth <= 760/)
}

function runObservatoryAccessibilitySourceCheck() {
  const layoutSource = readFileSync(join(__dirname, '../src/components/observatory/ObservatoryLayout.tsx'), 'utf8')
  const reportSource = readFileSync(join(__dirname, '../src/components/observatory/CandleReportPage.tsx'), 'utf8')
  assert.match(layoutSource, /aria-controls="obs-diagnostics-detail"/)
  assert.match(layoutSource, /aria-controls="obs-live-chart-panel"/)
  assert.match(layoutSource, /aria-controls="obs-catalog-panel"/)
  assert.match(reportSource, /aria-label="Previous candle"/)
  assert.match(reportSource, /aria-label="Next candle"/)
  assert.match(reportSource, /aria-controls="obs-report-chart-panel"/)
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
  assert.match(persistRouteSource, /mode: 'cron'/)
  assert.match(persistRouteSource, /CRON_PERSISTENCE_DAYS/)
  assert.match(backfillRouteSource, /mode: 'backfill'/)
  assert.match(backfillRouteSource, /DEFAULT_BACKFILL_DAYS = 180/)
  assert.match(persistenceHelperSource, /OBSERVATORY_PERSIST_SECRET/)
  assert.match(persistenceHelperSource, /CRON_SECRET/)
  assert.match(persistenceHelperSource, /buildClosedIndicatorStateRecords/)
  assert.match(persistenceHelperSource, /observatory_indicator_states\?on_conflict=id/)
  assert.doesNotMatch(observatoryApiSource, /persistObservatoryLookback|observatory_indicator_states/)
  assert.match(vercelSource, /"path": "\/api\/persist-observatory-states"/)
  assert.match(vercelSource, /"schedule": "15 2 \* \* \*"/)
  assert.match(parityChecklistSource, /api\/persist-observatory-states\.ts/)
  assert.match(parityChecklistSource, /api\/backfill-observatory-states\.ts/)
  assert.match(engineeringMapSource, /Secret-gated cron writer/)
  assert.match(engineeringMapSource, /Secret-gated manual backfill route/)
}

function runObservatoryAnalyticsSourceCheck() {
  const analyticsPageSource = readFileSync(join(__dirname, '../src/components/observatory/AnalyticsPage.tsx'), 'utf8')
  const analyticsModuleSource = readFileSync(join(__dirname, '../src/observatory/analytics.ts'), 'utf8')
  const analyticsApiSource = readFileSync(join(__dirname, '../api/observatory-analytics.ts'), 'utf8')
  const analyticsHelperSource = readFileSync(join(__dirname, '../api/_observatoryAnalytics.ts'), 'utf8')
  const parityChecklistSource = readFileSync(join(__dirname, '../docs/production-parity-checklist.md'), 'utf8')
  const engineeringMapSource = readFileSync(join(__dirname, '../docs/engineering-map.md'), 'utf8')

  assert.match(analyticsPageSource, /\/api\/observatory-analytics\?coin=/)
  assert.match(analyticsPageSource, /buildSnapshotAnalytics/)
  assert.match(analyticsPageSource, /Live window fallback/)
  assert.match(analyticsPageSource, /LEDGER_LOOKBACK_DAYS = 180/)
  assert.match(analyticsPageSource, /analytics\.days\}d ledger/)
  assert.match(analyticsModuleSource, /export function buildPersistedObservatoryAnalytics/)
  assert.match(analyticsModuleSource, /export function buildSnapshotAnalytics/)
  assert.match(analyticsApiSource, /loadPersistedObservatoryAnalytics/)
  assert.match(analyticsApiSource, /days = parsePositiveInteger/)
  assert.match(analyticsHelperSource, /from '\.\/_signals\.mjs'/)
  assert.doesNotMatch(analyticsHelperSource, /import \{ buildPersistedObservatoryAnalytics .* from '\.\.\/src\/observatory\/analytics'/)
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

function runReplayPass(candles, funding, oi, checkpoints) {
  return checkpoints.map((timestamp) => {
    const signal = signals.computeSignalsAtTime('BTC', candles, funding, oi, timestamp)
    if (!signal) return null

    const candle = candles.find((entry) => entry.time === timestamp)
    const setup = signals.computeSuggestedSetup('BTC', signal, candle ? candle.close : 0, {
      generatedAt: timestamp,
      source: 'backfill',
    })

    return setup
      ? {
          direction: setup.direction,
          confidenceTier: setup.confidenceTier,
          confidence: Number(setup.confidence.toFixed(6)),
          entryPrice: Number(setup.entryPrice.toFixed(6)),
          stopPrice: Number(setup.stopPrice.toFixed(6)),
          targetPrice: Number(setup.targetPrice.toFixed(6)),
        }
      : null
  })
}

function buildReplayCandles(count, startPrice) {
  const start = Date.UTC(2026, 1, 1, 0, 0, 0)
  const result = []
  let prevClose = startPrice

  for (let i = 0; i < count; i += 1) {
    const drift = Math.sin(i / 8) * 0.4 + Math.cos(i / 13) * 0.25
    const close = prevClose + drift
    const high = Math.max(prevClose, close) + 0.8
    const low = Math.min(prevClose, close) - 0.8
    result.push(candle(start + i * 3_600_000, prevClose, high, low, close))
    prevClose = close
  }

  return result
}

function buildObservatoryCandles(count, startPrice) {
  const start = Date.UTC(2026, 0, 1, 0, 0, 0)
  const result = []
  let prevClose = startPrice

  for (let i = 0; i < count; i += 1) {
    const drift = Math.sin(i / 8) * 0.9 + Math.cos(i / 21) * 0.45 + i * 0.006
    const close = prevClose + drift
    const open = prevClose
    const high = Math.max(open, close) + 0.55 + Math.sin(i / 11) * 0.12
    const low = Math.min(open, close) - 0.55 - Math.cos(i / 14) * 0.11
    const volume = 1200 + Math.sin(i / 6) * 220 + i * 1.3
    const trades = 480 + Math.cos(i / 5) * 60 + i * 0.45

    result.push({
      time: start + i * 4 * 3_600_000,
      open,
      high,
      low,
      close,
      volume,
      trades,
    })
    prevClose = close
  }

  return result
}

function candle(time, open, high, low, close) {
  return { time, open, high, low, close, volume: 1, trades: 1 }
}

function snapshot(time, oi) {
  return { time, oi }
}

function buildFlatCandles(startTime, hours, close) {
  return Array.from({ length: hours }, (_, index) =>
    candle(startTime + index * 60 * 60 * 1000, close, close + 0.5, close - 0.5, close),
  )
}

function buildSignals(overrides = {}) {
  const {
    hurst,
    zScore,
    funding,
    oiDelta,
    volatility,
    entryGeometry,
    composite,
    ...topLevelOverrides
  } = overrides

  return {
    coin: 'BTC',
    hurst: {
      value: 0.44,
      regime: 'mean-reverting',
      color: 'green',
      confidence: 0.8,
      explanation: 'hurst',
      ...(hurst ?? {}),
    },
    zScore: {
      value: -2.1,
      normalizedSignal: 0.8,
      label: 'Oversold',
      color: 'green',
      explanation: 'z',
      ...(zScore ?? {}),
    },
    funding: {
      currentRate: 0,
      zScore: -1,
      normalizedSignal: 0.4,
      label: 'Funding',
      color: 'yellow',
      explanation: 'funding',
      ...(funding ?? {}),
    },
    oiDelta: {
      oiChangePct: 1,
      priceChangePct: -1,
      confirmation: true,
      normalizedSignal: 1,
      label: 'OI',
      color: 'green',
      explanation: 'oi',
      ...(oiDelta ?? {}),
    },
    volatility: {
      realizedVol: 0.6,
      atr: 2,
      level: 'normal',
      color: 'yellow',
      explanation: 'vol',
      ...(volatility ?? {}),
    },
    entryGeometry: {
      distanceFromMeanPct: -2,
      stretchZEquivalent: -2.2,
      atrDislocation: 1.4,
      bandPosition: 0.15,
      meanPrice: 105,
      reversionPotential: 0.75,
      chaseRisk: 0.1,
      entryQuality: 'ideal',
      directionBias: 'long',
      color: 'green',
      explanation: 'geometry',
      ...(entryGeometry ?? {}),
    },
    composite: {
      value: 0.48,
      direction: 'long',
      strength: 'moderate',
      agreementCount: 4,
      agreementTotal: 5,
      color: 'green',
      label: 'Composite',
      explanation: 'composite',
      signalBreakdown: [],
      ...(composite ?? {}),
    },
    updatedAt: Date.now(),
    isStale: false,
    isWarmingUp: false,
    warmupProgress: 1,
    ...topLevelOverrides,
  }
}

function runBundleDriftCheck() {
  checkBundle('_signals', signals, join(__dirname, '../api/_signals.d.mts'))
}

function checkBundle(name, mod, declPath) {
  const decl = readFileSync(declPath, 'utf8')
  const declared = [...decl.matchAll(/export\s+function\s+(\w+)/g)].map((m) => m[1])

  const missing = declared.filter((fn) => typeof mod[fn] !== 'function')
  if (missing.length > 0) {
    throw new Error(`Bundle drift: ${name}.d.mts declares functions missing from ${name}.mjs: ${missing.join(', ')}`)
  }
}

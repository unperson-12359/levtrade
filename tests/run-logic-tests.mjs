import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const signals = await import('../api/_signals.mjs')
const collector = await import('../api/_collector.mjs')
const {
  resolveSetupWindow,
  computeOIDelta,
  computeProvisionalSetup,
  computePositionPolicy,
  computeSuggestedPositionComposition,
  deriveCompositionRiskStatus,
  computeSetupMetrics,
} = signals

runResolveOutcomeTest()
runSettlementBoundaryTests()
runOiDeltaTest()
runBuildSetupIdExportTest()
runProvisionalSetupGateTest()
runPositionPolicyTest()
runSuggestedPositionCompositionTest()
runIncrementalRefreshSourceCheck()
runWorkflowTerminologyCheck()
runWorkflowStateSourceCheck()
runDashboardLayoutReflowCheck()
runEntryReadinessRailSourceCheck()
runStep2KpiLayoutCheck()
runSuggestedSetupKpiLayoutCheck()
runStep1CompactDensityCheck()
runLiveTickerTapeCheck()
runStep3CompactDensityCheck()
runHeroPairCompressionCheck()
runTrackerRiskSourceCheck()
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
  // 5 candles: 21:00 through 01:00 inclusive (floor of signal hour through floor of boundary)
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

function runIncrementalRefreshSourceCheck() {
  const apiSource = readFileSync(join(__dirname, '../src/services/api.ts'), 'utf8')
  const managerSource = readFileSync(join(__dirname, '../src/services/dataManager.ts'), 'utf8')
  const serverApiSource = readFileSync(join(__dirname, '../api/server-setups.ts'), 'utf8')
  const repairScriptSource = readFileSync(join(__dirname, '../scripts/recompute-server-outcomes.ts'), 'utf8')

  assert.match(apiSource, /updatedSince\?: string/)
  assert.match(managerSource, /lastServerSetupFetchAt/)
  assert.match(managerSource, /updatedSince: this\.lastServerSetupFetchAt/)
  assert.match(serverApiSource, /resolveUpdatedSince/)
  assert.match(repairScriptSource, /MAX_FETCH_ROWS = 10_000/)
}

function runWorkflowTerminologyCheck() {
  const workflowSource = readFileSync(join(__dirname, '../src/utils/workflowGuidance.ts'), 'utf8')
  assert.match(workflowSource, /title: 'POSITION COMPOSITION'/)
  assert.match(workflowSource, /account-sized composition/)
}

function runWorkflowStateSourceCheck() {
  const workflowSource = readFileSync(join(__dirname, '../src/utils/workflowGuidance.ts'), 'utf8')
  const marketSource = readFileSync(join(__dirname, '../src/components/market/MarketRail.tsx'), 'utf8')
  const signalSource = readFileSync(join(__dirname, '../src/components/signal/SignalSection.tsx'), 'utf8')
  const riskSource = readFileSync(join(__dirname, '../src/components/risk/RiskSection.tsx'), 'utf8')
  const bannerSource = readFileSync(join(__dirname, '../src/components/methodology/MethodologyBanner.tsx'), 'utf8')
  const menuSource = readFileSync(join(__dirname, '../src/components/menu/MenuDrawer.tsx'), 'utf8')
  const stepLabelSource = readFileSync(join(__dirname, '../src/components/methodology/StepLabel.tsx'), 'utf8')
  const cssSource = readFileSync(join(__dirname, '../src/index.css'), 'utf8')

  assert.match(workflowSource, /export function getWorkflowStepStates/)
  assert.match(workflowSource, /export type WorkflowVisualState = 'pass' \| 'fail' \| 'wait'/)
  assert.match(workflowSource, /export type WorkflowAccessState = 'current' \| 'unlocked' \| 'locked'/)
  assert.match(workflowSource, /label: 'LOCKED'/)
  assert.match(workflowSource, /label: provisionalIsDanger \? 'DO NOT TAKE' : 'DRAFT ONLY'/)
  assert.match(marketSource, /workflow-card/)
  assert.match(signalSource, /workflow-card/)
  assert.match(riskSource, /workflow-card/)
  assert.match(riskSource, /status-pill status-pill--\$\{step3\.tone\}/)
  assert.match(bannerSource, /methodology-step--\$\{step\.state\}/)
  assert.match(menuSource, /menu-drawer__workflow-row--\$\{step\.access\}/)
  assert.match(stepLabelSource, /STEP \$\{step\} OF 3/)
  assert.match(cssSource, /\.workflow-card--pulse/)
  assert.match(cssSource, /\.methodology-step__detail--next/)
  assert.match(cssSource, /prefers-reduced-motion: reduce/)
}

function runDashboardLayoutReflowCheck() {
  const layoutSource = readFileSync(join(__dirname, '../src/components/layout/DashboardLayout.tsx'), 'utf8')
  const liveRailSource = readFileSync(join(__dirname, '../src/components/predictions/HotPredictionsBanner.tsx'), 'utf8')
  const cssSource = readFileSync(join(__dirname, '../src/index.css'), 'utf8')

  assert.match(layoutSource, /className="dashboard-shell has-bottom-rail-padding"/)
  assert.match(layoutSource, /className="workflow-row-top workflow-row-top--split"/)
  assert.match(layoutSource, /className="workflow-row-top__decision"/)
  assert.match(layoutSource, /className="workflow-row-top__signal"/)
  assert.match(layoutSource, /<DecisionHero \/>/)
  assert.match(layoutSource, /<SignalSection \/>/)
  assert.match(layoutSource, /className="workflow-row-main"/)
  assert.match(layoutSource, /className="workflow-col-left"/)
  assert.match(layoutSource, /className="workflow-col-center"/)
  assert.match(layoutSource, /className="workflow-col-right"/)
  assert.match(layoutSource, /<MarketRail \/>/)
  assert.match(layoutSource, /<RiskSection \/>/)
  assert.match(layoutSource, /<PriceChart coin=\{coin\} embedded showHeader=\{false\} \/>/)
  assert.match(liveRailSource, /className="live-rail-shell"/)
  assert.match(liveRailSource, /className="live-rail-track scrollbar-hide"/)
  assert.match(cssSource, /\.live-rail-shell \{\s*position: fixed;/)
  assert.match(cssSource, /\.workflow-row-top--split \{/)
  assert.match(cssSource, /align-items: stretch;/)
  assert.match(cssSource, /\.workflow-row-top__decision,/)
  assert.match(cssSource, /\.workflow-row-top__signal \{/)
  assert.match(cssSource, /\.workflow-row-top__decision \.decision-hero,/)
  assert.match(cssSource, /\.workflow-row-top__signal \.workflow-card \{/)
  assert.match(cssSource, /\.workflow-row-main \{/)
}

function runEntryReadinessRailSourceCheck() {
  const layoutSource = readFileSync(join(__dirname, '../src/components/layout/DashboardLayout.tsx'), 'utf8')
  const railSource = readFileSync(join(__dirname, '../src/components/chart/EntryReadinessRail.tsx'), 'utf8')
  const hookSource = readFileSync(join(__dirname, '../src/hooks/useEntryReadiness.ts'), 'utf8')
  const cssSource = readFileSync(join(__dirname, '../src/index.css'), 'utf8')

  assert.match(layoutSource, /EntryReadinessRail/)
  assert.match(layoutSource, /className="chart-header-row chart-header-row--enhanced"/)
  assert.match(layoutSource, /<EntryReadinessRail coin=\{coin\} \/>/)

  assert.match(railSource, /className="entry-readiness-rail"/)
  assert.match(railSource, /className="entry-readiness-rail__lights"/)
  assert.match(railSource, /entry-readiness-light--\$\{light\.state\}/)
  assert.match(railSource, /role="progressbar"/)
  assert.match(railSource, /entry-readiness-gauge__needle/)
  assert.match(railSource, /entry-readiness-rail__pct--\$\{readiness\.band\}/)

  assert.match(hookSource, /computeSetupMetrics/)
  assert.match(hookSource, /probabilityPct/)
  assert.match(hookSource, /Data Fresh/)
  assert.match(hookSource, /Warmup/)
  assert.match(hookSource, /Regime/)
  assert.match(hookSource, /Price Position/)
  assert.match(hookSource, /Crowd Positioning/)
  assert.match(hookSource, /Money Flow/)
  assert.match(hookSource, /Entry Geometry/)
  assert.match(hookSource, /Composite Output/)

  assert.match(cssSource, /\.chart-header-row--enhanced \{/)
  assert.match(cssSource, /\.entry-readiness-rail \{/)
  assert.match(cssSource, /\.entry-readiness-light--on \{/)
  assert.match(cssSource, /\.entry-readiness-progress__fill--high \{/)
  assert.match(cssSource, /\.entry-readiness-gauge__needle \{/)
}

function runStep2KpiLayoutCheck() {
  const signalSource = readFileSync(join(__dirname, '../src/components/signal/SignalSection.tsx'), 'utf8')
  const geometrySource = readFileSync(join(__dirname, '../src/components/entry/EntryGeometryPanel.tsx'), 'utf8')
  const cssSource = readFileSync(join(__dirname, '../src/index.css'), 'utf8')

  assert.doesNotMatch(signalSource, /sectionId="step2-advanced"/)
  assert.doesNotMatch(signalSource, /ExpandableSection/)
  assert.match(signalSource, /className="step2-parallel-shell"/)
  assert.match(signalSource, /className="step2-parallel-shell__setup"/)
  assert.match(signalSource, /className="step2-parallel-shell__kpis"/)
  assert.match(signalSource, /className="step2-kpi-shell"/)
  assert.match(signalSource, /className="step2-kpi-row step2-kpi-row--double"/)
  assert.doesNotMatch(signalSource, /step2-kpi-row--single/)
  assert.match(signalSource, /<EntryGeometryPanel embedded mode="compactKpi" \/>/)
  assert.match(geometrySource, /mode\?: 'default' \| 'compactKpi'/)
  assert.match(geometrySource, /if \(mode === 'compactKpi'\)/)
  assert.doesNotMatch(geometrySource, /step2-kpi-row--geometry/)
  assert.match(cssSource, /\.step2-parallel-shell \{/)
  assert.match(cssSource, /\.step2-parallel-shell__setup \.setup-card \{/)
  assert.match(cssSource, /\.step2-kpi-shell \{/)
  assert.match(cssSource, /\.step2-kpi-row \{/)
  assert.match(cssSource, /\.step2-kpi-row--double \{/)
  assert.doesNotMatch(cssSource, /\.step2-kpi-row--single \{/)
  assert.match(cssSource, /\.step2-kpi-card--clickable/)
}

function runSuggestedSetupKpiLayoutCheck() {
  const setupSource = readFileSync(join(__dirname, '../src/components/setup/SetupCard.tsx'), 'utf8')
  const cssSource = readFileSync(join(__dirname, '../src/index.css'), 'utf8')

  assert.match(setupSource, /className="setup-card__kpi-row"/)
  assert.match(setupSource, /setup-kpi-card/)
  assert.match(setupSource, /className="panel-title setup-card__title"/)
  assert.match(setupSource, /className="panel-copy setup-card__empty-copy"/)
  assert.match(setupSource, /className="decision-strip__chips setup-card__empty-reasons"/)
  assert.match(setupSource, /className="setup-card__summary setup-card__summary--compact"/)
  assert.doesNotMatch(setupSource, /setup-card__prices/)
  assert.match(cssSource, /\.setup-card__kpi-row \{/)
  assert.match(cssSource, /grid-template-columns: repeat\(9, minmax\(0, 1fr\)\);/)
  assert.match(cssSource, /\.setup-kpi-card \{/)
  assert.match(cssSource, /\.step2-parallel-shell__setup \.setup-card__summary--compact \{/)
  assert.match(cssSource, /\.step2-parallel-shell__setup \.setup-card__empty-copy \{/)
  assert.match(cssSource, /\.step2-parallel-shell__setup \.setup-card__empty-reasons \{/)
}

function runStep1CompactDensityCheck() {
  const marketSource = readFileSync(join(__dirname, '../src/components/market/MarketRail.tsx'), 'utf8')
  const cssSource = readFileSync(join(__dirname, '../src/index.css'), 'utf8')
  const expandableSource = readFileSync(join(__dirname, '../src/components/shared/ExpandableSection.tsx'), 'utf8')

  assert.match(marketSource, /className="market-rail-grid step1-compact-grid"/)
  assert.match(marketSource, /className="context-panels context-panels--compact"/)
  assert.match(marketSource, /className="subpanel-shell step1-compact-tile"/)
  assert.match(marketSource, /className="step1-compact-copy"/)
  assert.match(cssSource, /\.step1-compact-grid \{/)
  assert.match(cssSource, /\.step1-compact-tile \{/)
  assert.match(cssSource, /\.step1-compact-copy \{/)
  assert.match(cssSource, /expandable-section\[data-section-id="step1-advanced"\]/)
  assert.match(expandableSource, /data-section-id=\{sectionId\}/)
}

function runLiveTickerTapeCheck() {
  const liveRailSource = readFileSync(join(__dirname, '../src/components/predictions/HotPredictionsBanner.tsx'), 'utf8')
  const cssSource = readFileSync(join(__dirname, '../src/index.css'), 'utf8')

  assert.match(liveRailSource, /className=\{\`live-rail-item/)
  assert.match(liveRailSource, /live-rail-item__coin/)
  assert.match(liveRailSource, /live-rail-item__direction/)
  assert.match(liveRailSource, /live-rail-item__status/)
  assert.doesNotMatch(liveRailSource, /live-rail-card__/)
  assert.match(cssSource, /\.live-rail-item \{/)
  assert.match(cssSource, /\.live-rail-item__coin \{/)
  assert.match(cssSource, /\.live-rail-item__status \{/)
}

function runStep3CompactDensityCheck() {
  const riskSectionSource = readFileSync(join(__dirname, '../src/components/risk/RiskSection.tsx'), 'utf8')
  const riskFormSource = readFileSync(join(__dirname, '../src/components/risk/RiskForm.tsx'), 'utf8')
  const riskResultsSource = readFileSync(join(__dirname, '../src/components/risk/RiskResults.tsx'), 'utf8')
  const cssSource = readFileSync(join(__dirname, '../src/index.css'), 'utf8')

  assert.match(riskSectionSource, /risk-stack--compact/)
  assert.match(riskSectionSource, /risk-section--compact/)
  assert.match(riskSectionSource, /risk-section__detail/)
  assert.match(riskFormSource, /risk-form--compact/)
  assert.match(riskFormSource, /risk-form__capital-row/)
  assert.match(riskFormSource, /risk-info-grid--compact/)
  assert.match(riskResultsSource, /risk-results--compact/)
  assert.match(riskResultsSource, /risk-kpi-grid--compact/)
  assert.match(riskResultsSource, /sectionId="step3-advanced"/)
  assert.match(riskResultsSource, /risk-stat-card/)
  assert.match(cssSource, /\.risk-section--compact \{/)
  assert.match(cssSource, /\.risk-form__capital-row \{/)
  assert.match(cssSource, /\.risk-kpi-grid--compact \{/)
  assert.match(cssSource, /expandable-section\[data-section-id="step3-advanced"\]/)
}

function runHeroPairCompressionCheck() {
  const heroSource = readFileSync(join(__dirname, '../src/components/decision/DecisionHero.tsx'), 'utf8')
  const cssSource = readFileSync(join(__dirname, '../src/index.css'), 'utf8')

  assert.match(heroSource, /decision-hero__pair/)
  assert.match(heroSource, /decision-hero__pair-card/)
  assert.match(heroSource, /decision-hero__pair-card--action/)
  assert.match(heroSource, /decision-hero__pair-card--wait/)
  assert.match(heroSource, /decision-hero__summary--compact/)
  assert.match(heroSource, /decision-hero__reasons-label/)
  assert.match(heroSource, /decision-hero__reason-chips/)
  assert.match(cssSource, /\.decision-hero__pair \{/)
  assert.match(cssSource, /\.decision-hero__pair-card \{/)
  assert.match(cssSource, /\.decision-hero__pair-card--action \{/)
  assert.match(cssSource, /\.decision-hero__pair-card--wait \{/)
  assert.match(cssSource, /\.decision-hero__summary--compact \{/)
  assert.match(cssSource, /\.decision-hero__reasons-label \{/)
  assert.match(cssSource, /\.decision-hero__reason-chips \{/)
  assert.match(cssSource, /@media \(min-width: 1281px\)/)
  assert.match(cssSource, /\.workflow-row-top--split \.workflow-row-top__signal > \.workflow-card > \.panel-copy \{/)
}

function runTrackerRiskSourceCheck() {
  const trackerSource = readFileSync(join(__dirname, '../src/store/trackerSlice.ts'), 'utf8')
  assert.match(trackerSource, /computeSuggestedPositionComposition/)
  assert.doesNotMatch(trackerSource, /computeRisk\(state\.riskInputs/)
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
  checkBundle('_collector', collector, join(__dirname, '../api/_collector.d.mts'))
}

function checkBundle(name, mod, declPath) {
  const decl = readFileSync(declPath, 'utf8')
  const declared = [...decl.matchAll(/export\s+function\s+(\w+)/g)].map((m) => m[1])

  const missing = declared.filter((fn) => typeof mod[fn] !== 'function')
  if (missing.length > 0) {
    throw new Error(`Bundle drift: ${name}.d.mts declares functions missing from ${name}.mjs: ${missing.join(', ')}`)
  }
}

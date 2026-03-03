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
  computeSetupMetrics,
} = signals

runResolveOutcomeTest()
runOiDeltaTest()
runBuildSetupIdExportTest()
runProvisionalSetupGateTest()
runPositionPolicyTest()
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

function candle(time, open, high, low, close) {
  return { time, open, high, low, close, volume: 1, trades: 1 }
}

function snapshot(time, oi) {
  return { time, oi }
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

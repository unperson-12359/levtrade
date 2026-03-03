import assert from 'node:assert/strict'

const { resolveSetupWindow, computeOIDelta } = await import('../api/_signals.mjs')

runResolveOutcomeTest()
runOiDeltaTest()

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

function candle(time, open, high, low, close) {
  return { time, open, high, low, close, volume: 1, trades: 1 }
}

function snapshot(time, oi) {
  return { time, oi }
}

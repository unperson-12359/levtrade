import { expect, test, type Page } from '@playwright/test'

type ScenarioMode = 'locked' | 'unlocked'
type HistoryMode = 'server' | 'fallback'

test.describe('LevTrade critical flows', () => {
  test('@critical load, coin switch, interval switch, and chart render', async ({ page }) => {
    await page.goto('/')
    await seedAppState(page, 'unlocked', 'server')

    await expect(page.locator('.topbar-shell')).toBeVisible()
    await expect(page.locator('.price-chart')).toBeVisible()

    await page.getByTestId('asset-pill-ETH').click()
    await expect(page.locator('button.asset-pill--active .asset-pill__symbol')).toHaveText('ETH')

    await page.getByTestId('interval-chip-4h').click()
    await expect(page.locator('.topbar-interval-chip--active')).toHaveText('4h')
    await expect(page.locator('.price-chart')).toBeVisible()
  })

  test('@critical step lock state and readiness parity when Step 1 fails', async ({ page }) => {
    await page.goto('/')
    await seedAppState(page, 'locked', 'fallback')

    await expect(page.getByTestId('readiness-lock-state')).toHaveText(/LOCKED BY STEP 1/)
    await assertReadinessParity(page)
  })

  test('@critical readiness parity and unlocked state when workflow is valid', async ({ page }) => {
    await page.goto('/')
    await seedAppState(page, 'unlocked', 'server')

    await expect(page.getByTestId('readiness-lock-state')).toHaveText(/UNLOCKED/)
    await assertReadinessParity(page)
  })

  test('@critical fallback history message appears only when canonical history is unavailable', async ({ page }) => {
    await page.goto('/')
    await seedAppState(page, 'unlocked', 'fallback')

    await page.getByTestId('open-menu-button').click()
    await page.getByTestId('open-analytics-button').click()

    await expect(page.getByText('Showing browser fallback setup history')).toBeVisible()

    await seedAppState(page, 'unlocked', 'server')
    await expect(page.getByText('Showing browser fallback setup history')).toHaveCount(0)
  })

  test('@critical analytics drawer tabs open and close cleanly', async ({ page }) => {
    await page.goto('/')
    await seedAppState(page, 'unlocked', 'server')

    await page.getByTestId('open-menu-button').click()
    await page.getByTestId('open-analytics-button').click()

    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()
    await page.getByRole('button', { name: 'Accuracy' }).click()
    await expect(page.getByText('Accuracy Tracker')).toBeVisible()

    await page.getByRole('button', { name: 'History' }).click()
    await expect(page.locator('.panel-kicker', { hasText: 'Setup history' }).first()).toBeVisible()

    await page.getByRole('button', { name: 'Data & Storage' }).click()
    await expect(page.locator('.panel-kicker', { hasText: 'Trust and storage' }).first()).toBeVisible()

    await page.getByTestId('close-analytics-button').click()
    await expect(page.locator('.guide-page--open')).toHaveCount(0)
  })

  test('@critical runtime diagnostics keep app visible under failure signals', async ({ page }) => {
    await page.goto('/')
    await seedAppState(page, 'unlocked', 'server')

    await page.evaluate(() => {
      const store = window.__LEVTRADE_STORE__
      if (!store) throw new Error('E2E store hook not installed')
      store.getState().pushRuntimeDiagnostic({
        source: 'e2e.network',
        message: 'Mock network outage',
      })
    })

    await expect(page.locator('.runtime-diagnostic-strip')).toBeVisible()
    await expect(page.locator('.runtime-diagnostic-strip')).toContainText('Mock network outage')
    await expect(page.locator('.topbar-shell')).toBeVisible()
  })
})

async function assertReadinessParity(page: Page) {
  const pctText = (await page.getByTestId('readiness-primary-pct').innerText()).trim()
  const countText = (await page.getByTestId('readiness-light-count').innerText()).trim()

  const pctMatch = pctText.match(/^(\d+)%$/)
  const countMatch = countText.match(/^(\d+)\/(\d+)\s+lights$/i)

  expect(pctMatch, `Unexpected readiness pct format: ${pctText}`).not.toBeNull()
  expect(countMatch, `Unexpected light-count format: ${countText}`).not.toBeNull()

  const pct = Number(pctMatch?.[1] ?? 0)
  const active = Number(countMatch?.[1] ?? 0)
  const total = Number(countMatch?.[2] ?? 1)
  const expectedPct = Math.round((active / total) * 100)

  expect(pct).toBe(expectedPct)
}

async function seedAppState(page: Page, scenario: ScenarioMode, history: HistoryMode) {
  const now = Date.now()
  const coins = ['BTC', 'ETH', 'SOL', 'HYPE'] as const
  const prices = {
    BTC: scenario === 'locked' ? '111000' : '100000',
    ETH: scenario === 'locked' ? '6200' : '5200',
    SOL: scenario === 'locked' ? '410' : '260',
    HYPE: scenario === 'locked' ? '31' : '22',
  }

  const candlesByCoin: Record<string, ReturnType<typeof buildCandles>> = {}
  const signalsByCoin: Record<string, ReturnType<typeof buildSignals>> = {}
  for (const coin of coins) {
    const basePrice = Number(prices[coin])
    candlesByCoin[coin] = buildCandles(basePrice, now, scenario)
    signalsByCoin[coin] = buildSignals(coin, now, scenario)
  }

  const localTrackedSetups = [buildTrackedSetup('local-e2e', now, false)]
  const serverTrackedSetups = history === 'server' ? [buildTrackedSetup('server-e2e', now, true)] : []

  await page.evaluate(({ now, prices, candlesByCoin, signalsByCoin, localTrackedSetups, serverTrackedSetups }) => {
    const store = window.__LEVTRADE_STORE__
    if (!store) throw new Error('E2E store hook not installed')

    const actions = store.getState()
    actions.setConnectionStatus('connected')
    actions.clearErrors()
    actions.clearRuntimeDiagnostics()
    actions.setPrices(prices)
    actions.selectCoin('BTC')
    actions.setInterval('1h')

    for (const coin of Object.keys(candlesByCoin)) {
      const candles = candlesByCoin[coin]
      actions.setCandles(coin, candles as any)
      actions.setResolutionCandles(coin, candles as any)
      actions.setExtendedCandles(coin, [])
    }

    store.setState((state: Record<string, unknown>) => ({
      ...state,
      signals: signalsByCoin,
      localTrackedSetups,
      serverTrackedSetups,
      trackerLastRunAt: now,
      lastSignalComputedAt: now,
    }))
  }, { now, prices, candlesByCoin, signalsByCoin, localTrackedSetups, serverTrackedSetups })
}

function buildCandles(basePrice: number, now: number, scenario: ScenarioMode) {
  const candles = []
  for (let i = 0; i < 160; i += 1) {
    const time = now - (160 - i) * 60 * 60 * 1000
    const drift = scenario === 'locked' ? i * 1.6 : Math.sin(i / 6) * 2.1
    const center = basePrice + drift
    candles.push({
      time,
      open: center - 0.7,
      high: center + 1.3,
      low: center - 1.4,
      close: center,
      volume: 1000 + i * 2,
      trades: 100 + i,
    })
  }
  return candles
}

function buildSignals(coin: string, now: number, scenario: ScenarioMode) {
  const locked = scenario === 'locked'
  return {
    coin,
    hurst: {
      value: locked ? 0.72 : 0.43,
      regime: locked ? 'trending' : 'mean-reverting',
      color: locked ? 'red' : 'green',
      confidence: 0.92,
      explanation: locked ? 'Trending regime blocks mean-reversion.' : 'Range-bound regime supports mean-reversion.',
    },
    zScore: {
      value: locked ? 0.2 : -2.4,
      normalizedSignal: locked ? 0.08 : 0.84,
      label: locked ? 'Neutral' : 'Oversold',
      color: locked ? 'yellow' : 'green',
      explanation: 'Synthetic E2E z-score',
    },
    funding: {
      currentRate: locked ? 0.00025 : -0.0002,
      zScore: locked ? 0.4 : -1.4,
      normalizedSignal: locked ? 0.1 : 0.62,
      label: locked ? 'Crowded long' : 'Crowded short',
      color: locked ? 'yellow' : 'green',
      explanation: 'Synthetic E2E funding',
    },
    oiDelta: {
      oiChangePct: locked ? 0.01 : 0.045,
      priceChangePct: locked ? 0.02 : -0.018,
      confirmation: !locked,
      normalizedSignal: locked ? 0.05 : 0.58,
      label: locked ? 'No confirmation' : 'Flow confirms',
      color: locked ? 'yellow' : 'green',
      explanation: 'Synthetic E2E OI delta',
    },
    volatility: {
      realizedVol: locked ? 58 : 36,
      atr: locked ? 4.8 : 2.2,
      level: locked ? 'high' : 'normal',
      color: locked ? 'yellow' : 'green',
      explanation: 'Synthetic E2E volatility',
    },
    entryGeometry: {
      distanceFromMeanPct: locked ? -0.2 : -2.8,
      stretchZEquivalent: locked ? -0.1 : -2.3,
      atrDislocation: locked ? 0.3 : 1.5,
      bandPosition: locked ? 0.48 : 0.12,
      meanPrice: locked ? 100 : 103,
      reversionPotential: locked ? 0.18 : 0.78,
      chaseRisk: locked ? 0.62 : 0.16,
      entryQuality: locked ? 'early' : 'ideal',
      directionBias: locked ? 'neutral' : 'long',
      color: locked ? 'yellow' : 'green',
      explanation: 'Synthetic E2E entry geometry',
    },
    composite: {
      value: locked ? 0.05 : 0.46,
      direction: locked ? 'neutral' : 'long',
      strength: locked ? 'weak' : 'moderate',
      agreementCount: locked ? 1 : 4,
      agreementTotal: 5,
      color: locked ? 'yellow' : 'green',
      label: locked ? 'Mixed' : 'Long bias',
      explanation: 'Synthetic E2E composite',
      signalBreakdown: [
        { name: 'Regime', direction: locked ? 'neutral' : 'long', agrees: !locked },
        { name: 'Price', direction: locked ? 'neutral' : 'long', agrees: !locked },
        { name: 'Crowd', direction: locked ? 'neutral' : 'long', agrees: !locked },
        { name: 'Flow', direction: locked ? 'neutral' : 'long', agrees: !locked },
      ],
    },
    updatedAt: now,
    isStale: false,
    isWarmingUp: false,
    warmupProgress: 1,
  }
}

function buildTrackedSetup(id: string, now: number, server: boolean) {
  const setup = {
    coin: 'BTC',
    direction: 'long',
    entryPrice: 100000,
    stopPrice: 98500,
    targetPrice: 104500,
    meanReversionTarget: 102300,
    rrRatio: 3,
    suggestedPositionSize: 250,
    suggestedLeverage: 3,
    tradeGrade: 'green',
    confidence: 0.71,
    confidenceTier: 'high',
    entryQuality: 'ideal',
    agreementCount: 4,
    agreementTotal: 5,
    regime: 'mean-reverting',
    reversionPotential: 0.76,
    stretchSigma: 2.2,
    atr: 2.4,
    compositeValue: 0.44,
    timeframe: '4-24h',
    summary: 'Synthetic setup for critical-flow E2E checks.',
    generatedAt: now - 2 * 60 * 60 * 1000,
    source: server ? 'server' : 'live',
  }

  const pendingOutcome = (window: '4h' | '24h' | '72h') => ({
    window,
    resolvedAt: null,
    result: 'pending',
    resolutionReason: 'pending',
    coverageStatus: 'full',
    candleCountUsed: 0,
    returnPct: null,
    rAchieved: null,
    mfe: null,
    mfePct: null,
    mae: null,
    maePct: null,
    targetHit: false,
    stopHit: false,
    priceAtResolution: null,
  })

  return {
    id,
    setup,
    coverageStatus: 'full',
    outcomes: {
      '4h': pendingOutcome('4h'),
      '24h': pendingOutcome('24h'),
      '72h': pendingOutcome('72h'),
    },
    syncEligible: !server,
  }
}

declare global {
  interface Window {
    __LEVTRADE_STORE__?: {
      getState: () => any
      setState: (nextState: any | ((state: any) => any)) => void
    }
  }
}

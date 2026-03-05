import { expect, test, type Page } from '@playwright/test'

test.describe('Observatory critical flows', () => {
  test('@critical load, coin switch, interval switch, and chart-cluster render', async ({ page }) => {
    await page.goto('/')
    await seedObservatoryState(page)

    await expect(page.getByTestId('obs-shell')).toBeVisible()
    await expect(page.getByTestId('obs-command-bar')).toBeVisible()
    await expect(page.getByTestId('obs-price-strip')).toBeVisible()
    await expect(page.getByTestId('obs-health-chip')).toBeVisible()
    await expect(page.locator('.price-chart')).toBeVisible()
    await expect(page.getByTestId('obs-cluster-lanes')).toBeVisible()
    await expect(page.getByTestId('obs-cluster-mode-simple')).toHaveClass(/obs-chip--active/)

    await page.locator('.obs-cluster__cell').first().click()
    await expect(page.getByTestId('obs-candle-report-page')).toBeVisible()
    await expect(page.getByTestId('obs-candle-report-chart')).toBeVisible()
    await expect(page.getByTestId('obs-cluster-candle-price')).toBeVisible()
    await expect(page.getByTestId('obs-cluster-report')).toBeVisible()
    await expect(page.getByTestId('obs-cluster-report-row').first()).toBeVisible()
    await expect(page).toHaveURL(/#\/observatory\/report/)
    await page.getByTestId('obs-candle-report-back').click()
    await expect(page).toHaveURL(/#\/observatory$/)
    await expect(page.getByTestId('obs-cluster-lanes')).toBeVisible()

    await page.getByTestId('obs-cluster-mode-pro').click()
    await expect(page.getByTestId('obs-cluster-mode-pro')).toHaveClass(/obs-chip--active/)

    await page.getByTestId('obs-coin-ETH').click()
    await expect(page.getByTestId('obs-coin-ETH')).toHaveClass(/obs-chip--active/)

    await page.getByTestId('obs-interval-1d').click()
    await expect(page.getByTestId('obs-interval-1d')).toHaveClass(/obs-chip--active/)
    await expect(page.getByTestId('obs-cluster-lanes')).toBeVisible()

    await page.getByTestId('obs-mode-advanced').click()
    await expect(page.getByTestId('obs-mode-advanced')).toHaveClass(/obs-chip--active/)
    await page.getByTestId('obs-mode-basic').click()
    await expect(page.getByTestId('obs-mode-basic')).toHaveClass(/obs-chip--active/)

    await page.getByTestId('obs-view-network').click()
    await expect(page.getByTestId('obs-map-legend')).toBeVisible()
    await expect(page.getByTestId('obs-pool-map')).toBeVisible()
  })

  test('@critical indicator selection updates drilldown', async ({ page }) => {
    await page.goto('/')
    await seedObservatoryState(page)
    await page.getByTestId('obs-view-network').click()

    await page.getByTestId('obs-indicator-row-momentum_rsi14').click()
    await expect(page.getByTestId('obs-detail-title')).toContainText('RSI 14')

    await page.getByTestId('obs-indicator-row-flow_funding_z20').click()
    await expect(page.getByTestId('obs-detail-title')).toContainText('Funding Z 20')
  })

  test('@critical strict no-recommendation copy is visible', async ({ page }) => {
    await page.goto('/')
    await seedObservatoryState(page)
    await page.getByTestId('obs-chip-policy').click()
    await expect(page.getByTestId('obs-no-reco-copy')).toContainText('it does not output trading calls')
  })

  test('@critical runtime diagnostics keep app visible under failure signals', async ({ page }) => {
    await page.goto('/')
    await seedObservatoryState(page)

    await page.evaluate(() => {
      const store = window.__LEVTRADE_STORE__
      if (!store) throw new Error('E2E store hook not installed')
      store.getState().pushRuntimeDiagnostic({
        source: 'e2e.mock',
        message: 'Mock runtime warning',
      })
    })

    await expect(page.locator('.obs-runtime')).toBeVisible()
    await expect(page.getByTestId('obs-chip-runtime')).toContainText('Runtime 1')
    await expect(page.locator('.obs-runtime')).toContainText('Mock runtime warning')
    await expect(page.getByTestId('obs-shell')).toBeVisible()
  })
})

async function seedObservatoryState(page: Page) {
  const now = Date.now()
  const coins = ['BTC', 'ETH', 'SOL', 'HYPE'] as const
  const basePrices: Record<(typeof coins)[number], number> = {
    BTC: 102_000,
    ETH: 5_400,
    SOL: 240,
    HYPE: 25,
  }

  const candlesByCoin: Record<string, ReturnType<typeof buildCandles>> = {}
  const fundingByCoin: Record<string, ReturnType<typeof buildFunding>> = {}
  const oiByCoin: Record<string, ReturnType<typeof buildOi>> = {}
  const prices: Record<string, string> = {}

  for (const coin of coins) {
    const base = basePrices[coin]
    candlesByCoin[coin] = buildCandles(base, now)
    fundingByCoin[coin] = buildFunding(now)
    oiByCoin[coin] = buildOi(base, now)
    prices[coin] = String(base)
  }

  await page.evaluate(({ prices, candlesByCoin, fundingByCoin, oiByCoin }) => {
    const store = window.__LEVTRADE_STORE__
    if (!store) throw new Error('E2E store hook not installed')
    const actions = store.getState()
    actions.selectCoin('BTC')
    actions.setInterval('4h')
    actions.setConnectionStatus('connected')
    actions.setPrices(prices)
    actions.clearErrors()
    actions.clearRuntimeDiagnostics()

    for (const coin of Object.keys(candlesByCoin)) {
      const candles = candlesByCoin[coin]
      const funding = fundingByCoin[coin]
      const oi = oiByCoin[coin]
      actions.setCandles(coin, candles as any)
      actions.setResolutionCandles(coin, candles as any)
      actions.setExtendedCandles(coin, [])
      for (const entry of funding) {
        actions.appendFundingRate(coin, entry.time, entry.rate)
      }
      for (const entry of oi) {
        actions.appendOI(coin, entry.time, entry.oi)
      }
    }
  }, { prices, candlesByCoin, fundingByCoin, oiByCoin })
}

function buildCandles(basePrice: number, now: number) {
  const candles = []
  for (let index = 0; index < 800; index += 1) {
    const time = now - (800 - index) * 60 * 60 * 1000
    const drift = Math.sin(index / 9) * basePrice * 0.012 + Math.cos(index / 23) * basePrice * 0.008 + index * basePrice * 0.00002
    const close = basePrice + drift
    candles.push({
      time,
      open: close * 0.996,
      high: close * 1.004,
      low: close * 0.994,
      close,
      volume: 1000 + Math.sin(index / 6) * 280 + index * 0.75,
      trades: 420 + Math.cos(index / 5) * 55 + index * 0.3,
    })
  }
  return candles
}

function buildFunding(now: number) {
  const points = []
  for (let index = 0; index < 800; index += 1) {
    const time = now - (800 - index) * 60 * 60 * 1000
    points.push({
      time,
      rate: Math.sin(index / 14) * 0.00018 + Math.cos(index / 31) * 0.00008,
    })
  }
  return points
}

function buildOi(basePrice: number, now: number) {
  const points = []
  for (let index = 0; index < 800; index += 1) {
    const time = now - (800 - index) * 60 * 60 * 1000
    points.push({
      time,
      oi: Math.max(1, 220_000 + Math.sin(index / 18) * 18_000 + Math.cos(index / 27) * 7_000 + basePrice * 0.4),
    })
  }
  return points
}

declare global {
  interface Window {
    __LEVTRADE_STORE__?: {
      getState: () => any
      setState: (nextState: any | ((state: any) => any)) => void
    }
  }
}

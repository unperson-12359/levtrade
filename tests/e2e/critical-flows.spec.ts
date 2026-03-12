import { expect, test, type Page } from '@playwright/test'

test.describe('Observatory critical flows', () => {
  test('@critical load, coin switch, interval switch, and chart-cluster render', async ({ page }) => {
    await page.goto('/')
    await seedObservatoryState(page)

    await expect(page.getByTestId('obs-shell')).toBeVisible()
    await expect(page.getByTestId('obs-command-bar')).toBeVisible()
    await expect(page.getByTestId('obs-price-strip')).toBeVisible()
    await expect(page.getByTestId('obs-live-status')).toContainText('Live')
    await expect(page.locator('.price-chart')).toBeVisible()
    await expect(page.getByTestId('obs-chart-cluster-overlay')).toBeVisible()
    await expect(page.getByTestId('obs-chart-cluster-bubble').first()).toBeVisible()
    await expect(page.getByTestId('obs-chart-cluster-bubble').first()).toContainText(/\d+/)
    await expect(page.getByTestId('obs-cluster-lanes')).toBeVisible()
    await expect(page.getByTestId('obs-guide-strip')).toBeVisible()
    await expect(page.getByTestId('obs-guide-strip')).toHaveAttribute('data-guide-state', 'collapsed')
    await expect(page.getByTestId('obs-guide-expanded')).toBeHidden()
    await expect(page.getByTestId('obs-guide-toggle')).toContainText('Methodology')
    await expect(page.getByTestId('obs-cluster-mode-simple')).toHaveClass(/obs-chip--active/)
    await expect(page.getByTestId('obs-nav-observatory')).toBeVisible()
    await expect(page.getByTestId('obs-nav-analytics')).toBeVisible()
    await expect(page.getByTestId('obs-nav-methodology')).toBeVisible()

    // Methodology modal opens and closes
    await page.getByTestId('obs-nav-methodology').click()
    await expect(page.getByTestId('obs-methodology-modal')).toBeVisible()
    await expect(page.getByTestId('obs-methodology-page')).toBeVisible()
    await page.getByTestId('obs-methodology-modal').locator('.obs-methodology-modal__close').click()
    await expect(page.getByTestId('obs-methodology-modal')).toBeHidden()

    // Guide strip methodology button opens modal
    await page.getByTestId('obs-guide-toggle').click()
    await expect(page.getByTestId('obs-methodology-modal')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('obs-methodology-modal')).toBeHidden()

    // Bubble click opens report drawer inline
    await page.getByTestId('obs-chart-cluster-bubble').first().click()
    await expect(page.getByTestId('obs-report-drawer')).toBeVisible()
    await expect(page.getByTestId('obs-candle-report-page')).toBeVisible()
    // Close the drawer
    await page.getByTestId('obs-candle-report-back').click()
    await expect(page.getByTestId('obs-report-drawer')).toBeHidden()
    await expect(page.getByTestId('obs-chart-cluster-overlay')).toBeVisible()

    // Select a cluster cell and open report drawer
    const firstClusterCell = page.getByTestId('obs-cluster-cell').first()
    await expect(firstClusterCell).toBeVisible()
    await firstClusterCell.click()
    await expect(page.getByTestId('obs-selected-cluster-card')).toBeVisible()
    const openReportButton = page.getByTestId('obs-selected-cluster-open-report')
    await expect(openReportButton).toBeVisible()
    await expect(page).toHaveURL(/#\/observatory\?coin=BTC&interval=4h$/)
    await openReportButton.evaluate((button: HTMLButtonElement) => button.click())
    await expect(page.getByTestId('obs-report-drawer')).toBeVisible()
    await expect(page.getByTestId('obs-candle-report-page')).toBeVisible()
    await expect(page.getByTestId('obs-candle-report-chart')).toBeVisible()
    await expect(page.getByTestId('obs-cluster-candle-price')).toBeVisible()
    await expect(page.getByTestId('obs-report-metrics')).toBeVisible()
    await expect(page.getByTestId('obs-report-active-context')).toBeVisible()
    await expect(page.getByTestId('obs-report-category-share')).toBeVisible()
    await expect(page.getByTestId('obs-cluster-report')).toBeVisible()
    await expect(page.getByTestId('obs-cluster-report-row').first()).toBeVisible()
    await expect(page.locator('.obs-report__bar-time')).toContainText('UTC')
    // URL should NOT change — report is inline
    await expect(page).toHaveURL(/#\/observatory\?coin=BTC&interval=4h$/)
    // Close the drawer
    await page.getByTestId('obs-candle-report-back').click()
    await expect(page.getByTestId('obs-report-drawer')).toBeHidden()
    await expect(page.getByTestId('obs-cluster-lanes')).toBeVisible()

    await page.getByTestId('obs-cluster-mode-pro').click()
    await expect(page.getByTestId('obs-cluster-mode-pro')).toHaveClass(/obs-chip--active/)

    await page.getByTestId('obs-coin-ETH').click()
    await expect(page.getByTestId('obs-coin-ETH')).toHaveClass(/obs-chip--active/)

    await page.getByTestId('obs-interval-1d').click()
    await expect(page.getByTestId('obs-interval-1d')).toHaveClass(/obs-chip--active/)
    await seedObservatoryState(page, { selectedCoin: 'ETH', interval: '1d' })
    await expect(page.getByTestId('obs-chart-cluster-overlay')).toBeVisible()
    await expect(page.getByTestId('obs-cluster-lanes')).toBeVisible()
    await page.getByTestId('obs-cluster-mode-simple').click()
    await expect(page.getByTestId('obs-cluster-mode-simple')).toHaveClass(/obs-chip--active/)

    const dailyLaneTimes = await page.evaluate(() => {
      const lane = document.querySelector('.obs-cluster__lane')
      if (!lane) return []
      return Array.from(lane.querySelectorAll('[data-testid="obs-cluster-cell"]'))
        .map((cell) => (cell.getAttribute('title') ?? '').split(' | ')[0]?.replace(' UTC', ' GMT') ?? '')
        .map((value) => Date.parse(value))
        .filter((value) => Number.isFinite(value))
    })
    expect(dailyLaneTimes.length).toBeGreaterThanOrEqual(50)
    for (let index = 1; index < Math.min(dailyLaneTimes.length, 8); index += 1) {
      expect(dailyLaneTimes[index] - dailyLaneTimes[index - 1]).toBe(24 * 60 * 60 * 1000)
    }

    await page.getByTestId('obs-nav-analytics').click()
    await expect(page.getByTestId('obs-analytics-page')).toBeVisible()
    await expect(page.getByTestId('obs-analytics-source')).toBeVisible()
    await expect(page.getByTestId('obs-analytics-table')).toBeVisible()
    await expect(page.getByTestId('obs-analytics-inspector')).toBeVisible()
    await expect(page).toHaveURL(/#\/analytics\?coin=ETH&interval=1d$/)
    await page.getByTestId('obs-nav-observatory').click()
    await expect(page.getByTestId('obs-cluster-lanes')).toBeVisible()
    await expect(page).toHaveURL(/#\/observatory\?coin=ETH&interval=1d$/)

    await page.getByTestId('obs-view-network').click()
    await expect(page.getByTestId('obs-map-legend')).toBeVisible()
    await expect(page.getByTestId('obs-pool-map')).toBeVisible()

    // Methodology modal from nav
    await page.getByTestId('obs-nav-methodology').click()
    await expect(page.getByTestId('obs-methodology-modal')).toBeVisible()
    await expect(page.getByTestId('obs-methodology-page')).toBeVisible()
    await expect(page.getByTestId('obs-methodology-flow')).toBeVisible()
    await expect(page.getByTestId('obs-methodology-pages')).toBeVisible()
    await expect(page.getByTestId('obs-methodology-live')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('obs-methodology-modal')).toBeHidden()
  })

  test('@critical indicator selection updates drilldown', async ({ page }) => {
    await page.goto('/')
    await seedObservatoryState(page)
    await page.getByTestId('obs-view-network').click()

    await page.getByTestId('obs-indicator-row-momentum_rsi14').click()
    await expect(page.getByTestId('obs-detail-title')).toContainText('RSI 14')

    await page.getByTestId('obs-indicator-row-trend_sma_20_50_spread').click()
    await expect(page.getByTestId('obs-detail-title')).toContainText('SMA 20/50 Spread')
  })

  test('@critical live status is visible from the command bar', async ({ page }) => {
    await page.goto('/')
    await seedObservatoryState(page)
    await expect(page.getByTestId('obs-live-status')).toContainText('Live')
  })

  test('@critical prev/next candle navigation in report drawer', async ({ page }) => {
    await page.goto('/')
    await seedObservatoryState(page)

    // Open a report from a heatmap cell
    await page.getByTestId('obs-cluster-cell').first().click()
    await page.getByTestId('obs-selected-cluster-open-report').click()
    await expect(page.getByTestId('obs-candle-report-page')).toBeVisible()
    await expect(page.getByTestId('obs-report-drawer')).toBeVisible()

    // Step to next candle (if available)
    const nextBtn = page.getByTestId('obs-candle-report-next')
    await expect(nextBtn).toBeVisible()
    if (await nextBtn.isEnabled()) {
      await nextBtn.click()
      await expect(page.getByTestId('obs-candle-report-page')).toBeVisible()
    }

    // Step to prev candle (if available)
    const prevBtn = page.getByTestId('obs-candle-report-prev')
    await expect(prevBtn).toBeVisible()
    if (await prevBtn.isEnabled()) {
      await prevBtn.click()
      await expect(page.getByTestId('obs-candle-report-page')).toBeVisible()
    }

    // Close drawer
    await page.getByTestId('obs-candle-report-back').click()
    await expect(page.getByTestId('obs-report-drawer')).toBeHidden()
    await expect(page.getByTestId('obs-cluster-lanes')).toBeVisible()
    await expect(page).toHaveURL(/#\/observatory\?coin=BTC&interval=4h$/)
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

    await expect(page.getByTestId('obs-diagnostics-toggle')).toContainText('Diagnostics')
    await expect(page.getByTestId('obs-diagnostics-panel')).toBeVisible()
    await expect(page.getByTestId('obs-diagnostics-panel')).toContainText('Mock runtime warning')
    await expect(page.getByTestId('obs-shell')).toBeVisible()
  })
})

async function seedObservatoryState(
  page: Page,
  options: { selectedCoin?: 'BTC' | 'ETH' | 'SOL' | 'HYPE'; interval?: '4h' | '1d' } = {},
) {
  const now = Date.now()
  const coins = ['BTC', 'ETH', 'SOL', 'HYPE'] as const
  const basePrices: Record<(typeof coins)[number], number> = {
    BTC: 102_000,
    ETH: 5_400,
    SOL: 240,
    HYPE: 25,
  }

  const candlesByCoin: Record<string, { '4h': ReturnType<typeof buildCandles>; '1d': ReturnType<typeof buildCandles> }> = {}
  const prices: Record<string, string> = {}
  const selectedCoin = options.selectedCoin ?? 'BTC'
  const interval = options.interval ?? '4h'

  for (const coin of coins) {
    const base = basePrices[coin]
    candlesByCoin[coin] = {
      '4h': buildCandles(base, now, 4 * 60 * 60 * 1000, 800),
      '1d': buildCandles(base, now, 24 * 60 * 60 * 1000, 365),
    }
    prices[coin] = String(base)
  }

  await runWithStoreRetry(page, async () => {
    await page.waitForFunction(() => Boolean(window.__LEVTRADE_STORE__))
    await page.evaluate(({ prices, candlesByCoin, selectedCoin, interval }) => {
      const store = window.__LEVTRADE_STORE__
      if (!store) throw new Error('E2E store hook not installed')
      const actions = store.getState()
      actions.selectCoin(selectedCoin)
      actions.setInterval(interval)
      actions.setConnectionStatus('connected')
      actions.setPrices(prices)
      actions.clearRuntimeDiagnostics()

      for (const coin of Object.keys(candlesByCoin)) {
        actions.setCandles(coin, candlesByCoin[coin]['4h'] as any, '4h')
        actions.setCandles(coin, candlesByCoin[coin]['1d'] as any, '1d')
      }
    }, { candlesByCoin, interval, prices, selectedCoin })

    await page.waitForFunction(() => {
      const store = window.__LEVTRADE_STORE__
      if (!store) return false
      const state = store.getState()
      return (
        state.connectionStatus === 'connected' &&
        !!state.prices.BTC &&
        state.candles.BTC['4h'].length > 0 &&
        state.candles.BTC['1d'].length > 0
      )
    })
  })
  await expect(page.getByTestId('obs-cluster-lanes')).toBeVisible()
}

async function runWithStoreRetry(page: Page, action: () => Promise<void>, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      await action()
      return
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const isNavigationReset = message.includes('Execution context was destroyed') || message.includes('Target page, context or browser has been closed')
      if (!isNavigationReset || attempt === retries - 1) throw error
      await page.waitForTimeout(100)
    }
  }
}

function buildCandles(basePrice: number, now: number, stepMs: number, count: number) {
  const candles = []
  for (let index = 0; index < count; index += 1) {
    const time = now - (count - index) * stepMs
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

declare global {
  interface Window {
    __LEVTRADE_STORE__?: {
      getState: () => any
      setState: (nextState: any | ((state: any) => any)) => void
    }
  }
}

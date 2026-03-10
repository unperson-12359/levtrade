import type { StoreApi } from 'zustand'
import { POLL_INTERVAL_MS } from '../config/constants'
import { INTERVAL_CONFIG } from '../config/intervals'
import type { AppStore } from '../store'
import { TRACKED_COINS, parseCandle, type TrackedCoin } from '../types/market'
import { fetchAllMids, fetchCandles } from './api'
import { HyperliquidWS } from './websocket'

const NETWORK_FETCH_CONCURRENCY = 2
const NETWORK_REQUEST_GAP_MS = 80

export class DataManager {
  private ws: HyperliquidWS
  private store: StoreApi<AppStore>
  private pollTimer: ReturnType<typeof setTimeout> | null = null
  private pollInFlight = false
  private pollStopped = false
  private unsubscribers: (() => void)[] = []
  private initialized = false

  constructor(store: StoreApi<AppStore>) {
    this.store = store
    this.ws = new HyperliquidWS()
  }

  private get itvl() {
    return INTERVAL_CONFIG[this.store.getState().selectedInterval]
  }

  private get interval() {
    return this.store.getState().selectedInterval
  }

  private reportRuntimeIssue(source: string, error: unknown, fallbackMessage: string): string {
    const message = error instanceof Error ? error.message : fallbackMessage
    const stack = error instanceof Error ? error.stack ?? null : null

    this.store.getState().pushRuntimeDiagnostic({
      source: `data-manager:${source}`,
      message,
      stack,
    })

    return message
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    this.initialized = true
    this.pollStopped = false

    this.ws.onStatusChange((status) => {
      this.store.getState().setConnectionStatus(status)
    })
    this.ws.connect()

    const unsub = this.ws.subscribe({ type: 'allMids' }, (data) => {
      const mids = (data as { mids?: Record<string, string> })?.mids
      if (mids) {
        this.store.getState().setPrices(mids)
      }
    })
    this.unsubscribers.push(unsub)

    try {
      const selectedCoin = this.store.getState().selectedCoin
      const remainingCoins = TRACKED_COINS.filter((coin) => coin !== selectedCoin)
      await Promise.all([
        this.refreshPrices(),
        this.fetchAllCandles([selectedCoin]),
      ])
      if (remainingCoins.length > 0) {
        void this.fetchAllCandles(remainingCoins).catch((error) => {
          this.reportRuntimeIssue('hydrate-remaining-coins', error, 'Background candle hydration failed')
        })
      }
    } catch (error) {
      const message = this.reportRuntimeIssue('initialize', error, 'Failed to hydrate live observatory data')
      this.store.getState().addError(message)
    }

    this.startPolling()
  }

  async fetchAllCandles(coins: readonly TrackedCoin[] = TRACKED_COINS): Promise<void> {
    const { ms, candleCount } = this.itvl
    const now = Date.now()
    const startTime = now - candleCount * ms

    await runWithConcurrency(coins, NETWORK_FETCH_CONCURRENCY, async (coin) => {
      try {
        const rawCandles = await fetchCandles(coin, this.interval, startTime, now)
        const candles = rawCandles.map(parseCandle).sort((left, right) => left.time - right.time)
        this.store.getState().setCandles(coin, candles)
      } catch (error) {
        const message = this.reportRuntimeIssue(`fetch-candles:${coin}`, error, `Failed to fetch candles for ${coin}`)
        this.store.getState().addError(message)
      }
      await sleep(NETWORK_REQUEST_GAP_MS)
    })
  }

  private async refreshPrices(): Promise<void> {
    try {
      const mids = await fetchAllMids()
      this.store.getState().setPrices(mids)
    } catch (error) {
      const message = this.reportRuntimeIssue('fetch-all-mids', error, 'Failed to refresh live prices')
      this.store.getState().addError(message)
    }
  }

  private startPolling(): void {
    this.pollStopped = false
    this.scheduleNextPoll(POLL_INTERVAL_MS)
  }

  private scheduleNextPoll(delayMs = POLL_INTERVAL_MS): void {
    if (this.pollStopped) return
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
    }
    this.pollTimer = setTimeout(() => {
      void this.runPollingCycle()
    }, delayMs)
  }

  private async runPollingCycle(): Promise<void> {
    if (this.pollStopped) return
    if (this.pollInFlight) {
      this.scheduleNextPoll(POLL_INTERVAL_MS)
      return
    }

    this.pollInFlight = true
    try {
      await this.executePollingCycle()
    } finally {
      this.pollInFlight = false
      if (!this.pollStopped) {
        this.scheduleNextPoll(POLL_INTERVAL_MS)
      }
    }
  }

  private async executePollingCycle(): Promise<void> {
    const selectedCoin = this.store.getState().selectedCoin
    const remainingCoins = TRACKED_COINS.filter((coin) => coin !== selectedCoin)

    await Promise.all([
      this.refreshPrices(),
      this.fetchAllCandles([selectedCoin]),
    ])

    if (remainingCoins.length > 0) {
      await this.fetchAllCandles(remainingCoins)
    }
  }

  destroy(): void {
    for (const unsub of this.unsubscribers) {
      unsub()
    }
    this.unsubscribers = []
    this.ws.disconnect()
    this.pollStopped = true
    this.pollInFlight = false
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
    this.initialized = false
  }
}

async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return

  let cursor = 0
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (cursor < items.length) {
      const next = items[cursor]
      cursor += 1
      if (next !== undefined) {
        await worker(next)
      }
    }
  })

  await Promise.all(workers)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

import { TRACKED_COINS, parseCandle } from '../types/market'
import { fetchAllMids, fetchMetaAndAssetCtxs, fetchCandles, fetchFundingHistory } from './api'
import { HyperliquidWS } from './websocket'
import type { StoreApi } from 'zustand'
import type { AppStore } from '../store'

const CANDLE_INTERVAL = '1h'
const CANDLE_COUNT = 120 // enough for 100-period Hurst + buffer
const POLL_INTERVAL = 60_000 // 60s for metaAndAssetCtxs refresh
const MS_PER_HOUR = 3_600_000

export class DataManager {
  private ws: HyperliquidWS
  private store: StoreApi<AppStore>
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private unsubscribers: (() => void)[] = []
  private initialized = false

  constructor(store: StoreApi<AppStore>) {
    this.store = store
    this.ws = new HyperliquidWS()
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    // Connect WebSocket first for real-time prices
    this.ws.onStatusChange((status) => {
      this.store.getState().setConnectionStatus(status)
    })
    this.ws.connect()

    // Subscribe to real-time price updates
    const unsub = this.ws.subscribe({ type: 'allMids' }, (data) => {
      const mids = (data as { mids?: Record<string, string> })?.mids
      if (mids) {
        this.store.getState().setPrices(mids)
      }
    })
    this.unsubscribers.push(unsub)

    // Fetch initial data in parallel
    try {
      await Promise.all([
        this.fetchInitialData(),
        this.fetchAllCandles(),
        this.fetchAllFundingHistory(),
      ])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch initial data'
      this.store.getState().addError(msg)
    }

    // Start polling for fresh funding/OI
    this.startPolling()
  }

  private async fetchInitialData(): Promise<void> {
    try {
      // Fetch prices + meta
      const [mids, [meta, assetCtxs]] = await Promise.all([
        fetchAllMids(),
        fetchMetaAndAssetCtxs(),
      ])

      this.store.getState().setPrices(mids)

      // Map asset contexts to our tracked coins
      const universe = meta.universe
      for (const coin of TRACKED_COINS) {
        const idx = universe.findIndex((u) => u.name === coin)
        if (idx >= 0 && assetCtxs[idx]) {
          const ctx = assetCtxs[idx]
          this.store.getState().setAssetContext(coin, ctx)

          // Store initial OI snapshot
          const oi = parseFloat(ctx.openInterest)
          if (isFinite(oi)) {
            this.store.getState().appendOI(coin, Date.now(), oi)
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch market data'
      this.store.getState().addError(msg)
    }
  }

  private async fetchAllCandles(): Promise<void> {
    const now = Date.now()
    const startTime = now - CANDLE_COUNT * MS_PER_HOUR

    // Fetch sequentially to be gentle with rate limits
    for (const coin of TRACKED_COINS) {
      try {
        const rawCandles = await fetchCandles(coin, CANDLE_INTERVAL, startTime, now)
        const candles = rawCandles.map(parseCandle)
        this.store.getState().setCandles(coin, candles)
      } catch (err) {
        const msg = err instanceof Error ? err.message : `Failed to fetch candles for ${coin}`
        this.store.getState().addError(msg)
      }
      // Small delay between requests
      await sleep(200)
    }
  }

  private async fetchAllFundingHistory(): Promise<void> {
    const now = Date.now()
    // Fetch ~30 hourly funding periods (~30 hours)
    const startTime = now - 30 * MS_PER_HOUR

    for (const coin of TRACKED_COINS) {
      try {
        const history = await fetchFundingHistory(coin, startTime, now)
        for (const entry of history) {
          const rate = parseFloat(entry.fundingRate)
          if (isFinite(rate)) {
            this.store.getState().appendFundingRate(coin, entry.time, rate)
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : `Failed to fetch funding for ${coin}`
        this.store.getState().addError(msg)
      }
      await sleep(200)
    }
  }

  private startPolling(): void {
    this.pollTimer = setInterval(async () => {
      try {
        const [, [meta, assetCtxs]] = await Promise.all([
          fetchAllMids().then((mids) => this.store.getState().setPrices(mids)),
          fetchMetaAndAssetCtxs(),
        ])

        const universe = meta.universe
        for (const coin of TRACKED_COINS) {
          const idx = universe.findIndex((u) => u.name === coin)
          if (idx >= 0 && assetCtxs[idx]) {
            const ctx = assetCtxs[idx]
            this.store.getState().setAssetContext(coin, ctx)

            // Append OI snapshot
            const oi = parseFloat(ctx.openInterest)
            if (isFinite(oi)) {
              this.store.getState().appendOI(coin, Date.now(), oi)
            }

            // Append funding rate snapshot
            const fr = parseFloat(ctx.funding)
            if (isFinite(fr)) {
              this.store.getState().appendFundingRate(coin, Date.now(), fr)
            }
          }
        }

        // Trigger signal recomputation and resolve tracker outcomes
        this.store.getState().computeAllSignals()
        this.store.getState().resolveTrackedOutcomes()
        this.store.getState().pruneTrackerHistory()
      } catch {
        // Polling errors are non-fatal — next poll will try again
      }
    }, POLL_INTERVAL)
  }

  destroy(): void {
    for (const unsub of this.unsubscribers) {
      unsub()
    }
    this.unsubscribers = []
    this.ws.disconnect()
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    this.initialized = false
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

import { TRACKED_COINS, parseCandle } from '../types/market'
import type { SuggestedSetup } from '../types/setup'
import type { TrackedSetup } from '../types/setup'
import { fetchAllMids, fetchMetaAndAssetCtxs, fetchCandles, fetchFundingHistory } from './api'
import { HyperliquidWS } from './websocket'
import { computeSignalsAtTime, generateBackfillTimestamps } from '../signals/backfill'
import { computeSuggestedSetup } from '../signals/setup'
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
      await this.fetchServerSetups()
      await this.backfillMissedSetups()
      await this.backfillCandlesForPendingSetups()
      this.store.getState().computeAllSignals()
      this.store.getState().generateAllSetups()
      this.store.getState().trackAllDecisionSnapshots()
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

  private async backfillCandlesForPendingSetups(): Promise<void> {
    const state = this.store.getState()
    const pendingSetups = state.trackedSetups.filter((tracked) =>
      Object.values(tracked.outcomes).some((outcome) => outcome.result === 'pending'),
    )

    if (pendingSetups.length === 0) {
      return
    }

    const oldestByCoin = new Map<(typeof TRACKED_COINS)[number], number>()
    for (const tracked of pendingSetups) {
      const currentOldest = oldestByCoin.get(tracked.setup.coin)
      if (currentOldest === undefined || tracked.setup.generatedAt < currentOldest) {
        oldestByCoin.set(tracked.setup.coin, tracked.setup.generatedAt)
      }
    }

    for (const [coin, oldestTime] of oldestByCoin) {
      const existingCandles = state.candles[coin] ?? []
      const oldestCandleTime = existingCandles.length > 0 ? existingCandles[0]!.time : Date.now()
      if (oldestTime >= oldestCandleTime) {
        continue
      }

      try {
        const startTime = oldestTime - MS_PER_HOUR
        const rawCandles = await fetchCandles(coin, CANDLE_INTERVAL, startTime, oldestCandleTime)
        const candles = rawCandles.map(parseCandle)
        if (candles.length > 0) {
          this.store.getState().setExtendedCandles(coin, candles)
        }
      } catch {
        // Non-critical: the next poll/startup can try again.
      }

      await sleep(200)
    }

    this.store.getState().resolveSetupOutcomes()
  }

  private async fetchServerSetups(): Promise<void> {
    const state = this.store.getState()
    if (!state.cloudSyncEnabled || !state.cloudSyncSecret) {
      return
    }

    try {
      const res = await fetch('/api/server-setups?days=7', {
        headers: { 'x-levtrade-sync-secret': state.cloudSyncSecret },
      })
      if (!res.ok) return

      const payload = (await res.json()) as {
        ok: boolean
        setups: Array<{ id: string; setup: SuggestedSetup; outcomes: TrackedSetup['outcomes'] }>
      }
      if (!payload.ok || !Array.isArray(payload.setups)) return

      for (const serverSetup of payload.setups) {
        if (serverSetup.setup && typeof serverSetup.setup.generatedAt === 'number') {
          this.store.getState().trackSetup(serverSetup.setup, serverSetup.outcomes, serverSetup.id)
        }
      }
    } catch {
      // Non-critical: server setups are supplementary
    }
  }

  private async backfillMissedSetups(): Promise<void> {
    const state = this.store.getState()
    const lastComputed = state.lastSignalComputedAt

    // First run: nothing to backfill, just set the timestamp
    if (lastComputed === null) {
      return
    }

    const now = Date.now()
    const gapHours = (now - lastComputed) / MS_PER_HOUR

    // Less than 2 hours: live computation will cover it
    if (gapHours < 2) {
      return
    }

    // Fetch extended candles if gap exceeds the standard 120h window
    if (gapHours > CANDLE_COUNT) {
      await this.fetchExtendedCandlesForBackfill(Math.ceil(gapHours) + CANDLE_COUNT)
    }

    // Fetch extended funding history covering the gap
    if (gapHours <= 200) {
      await this.fetchExtendedFundingForBackfill(lastComputed)
    }

    const timestamps = generateBackfillTimestamps(lastComputed, now)
    if (timestamps.length === 0) return

    for (const coin of TRACKED_COINS) {
      const candles = state.candles[coin]
      const fundingHistory = state.fundingHistory[coin]
      const oiHistory = state.oiHistory[coin]

      for (const timestamp of timestamps) {
        const signals = computeSignalsAtTime(coin, candles, fundingHistory, oiHistory, timestamp)
        if (!signals) continue

        // Find price at timestamp: closest candle close at or before that time
        const priceCandle = [...candles].reverse().find((c) => c.time <= timestamp)
        const price = priceCandle?.close
        if (!price || !isFinite(price) || price <= 0) continue

        const setup = computeSuggestedSetup(coin, signals, price, {
          generatedAt: timestamp,
          source: 'backfill',
        })
        if (setup) {
          this.store.getState().trackSetup(setup)
        }
      }
    }

    this.store.getState().sortSetupsByTime()
  }

  private async fetchExtendedCandlesForBackfill(hoursNeeded: number): Promise<void> {
    const now = Date.now()
    const startTime = now - hoursNeeded * MS_PER_HOUR

    for (const coin of TRACKED_COINS) {
      try {
        const rawCandles = await fetchCandles(coin, CANDLE_INTERVAL, startTime, now)
        const candles = rawCandles.map(parseCandle)
        this.store.getState().setCandles(coin, candles)
      } catch {
        // Non-critical: backfill will use whatever candles are available
      }
      await sleep(200)
    }
  }

  private async fetchExtendedFundingForBackfill(since: number): Promise<void> {
    for (const coin of TRACKED_COINS) {
      try {
        const history = await fetchFundingHistory(coin, since, Date.now())
        for (const entry of history) {
          const rate = parseFloat(entry.fundingRate)
          if (isFinite(rate)) {
            this.store.getState().appendFundingRate(coin, entry.time, rate)
          }
        }
      } catch {
        // Non-critical: backfill will use neutral funding fallback
      }
      await sleep(200)
    }
  }

  private async refreshCandlesIfNeeded(coin: (typeof TRACKED_COINS)[number], now: number): Promise<void> {
    const latestCandle = this.store.getState().candles[coin].slice(-1)[0]
    const candleAge = latestCandle ? now - latestCandle.time : Infinity

    if (candleAge <= MS_PER_HOUR) {
      return
    }

    const startTime = now - CANDLE_COUNT * MS_PER_HOUR
    const rawCandles = await fetchCandles(coin, CANDLE_INTERVAL, startTime, now)
    const candles = rawCandles.map(parseCandle)
    this.store.getState().setCandles(coin, candles)
  }

  private startPolling(): void {
    this.pollTimer = setInterval(async () => {
      try {
        const now = Date.now()
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
              this.store.getState().appendOI(coin, now, oi)
            }

            // Append funding rate snapshot
            const fr = parseFloat(ctx.funding)
            if (isFinite(fr)) {
              this.store.getState().appendFundingRate(coin, now, fr)
            }
          }

          await this.refreshCandlesIfNeeded(coin, now)
        }

        // Trigger signal recomputation, generate setups for all coins, and resolve outcomes
        this.store.getState().computeAllSignals()
        this.store.getState().generateAllSetups()
        this.store.getState().trackAllDecisionSnapshots()
        this.store.getState().resolveTrackedOutcomes()
        this.store.getState().resolveSetupOutcomes()
        this.store.getState().pruneTrackerHistory()
        this.store.getState().pruneSetupHistory()
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

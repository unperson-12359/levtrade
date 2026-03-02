import { TRACKED_COINS, parseCandle } from '../types/market'
import type { SuggestedSetup } from '../types/setup'
import type { TrackedSetup } from '../types/setup'
import { fetchAllMids, fetchMetaAndAssetCtxs, fetchCandles, fetchFundingHistory } from './api'
import { HyperliquidWS } from './websocket'
import { computeSignalsAtTime, generateBackfillTimestamps } from '../signals/backfill'
import { computeSuggestedSetup } from '../signals/setup'
import { INTERVAL_CONFIG } from '../config/intervals'
import type { StoreApi } from 'zustand'
import type { AppStore } from '../store'

import { POLL_INTERVAL_MS, SETUP_RESOLUTION_INTERVAL, SETUP_RESOLUTION_LOOKBACK_MS } from '../config/constants'

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

  private get itvl() {
    return INTERVAL_CONFIG[this.store.getState().selectedInterval]
  }

  private get interval() {
    return this.store.getState().selectedInterval
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

  async fetchAllCandles(): Promise<void> {
    const { ms, candleCount } = this.itvl
    const now = Date.now()
    const startTime = now - candleCount * ms

    // Fetch sequentially to be gentle with rate limits
    for (const coin of TRACKED_COINS) {
      try {
        const rawCandles = await fetchCandles(coin, this.interval, startTime, now)
        const candles = rawCandles.map(parseCandle)
        this.store.getState().setCandles(coin, candles)

        // When display interval is 1h, reuse for resolution
        if (this.interval === SETUP_RESOLUTION_INTERVAL) {
          this.store.getState().setResolutionCandles(coin, candles)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : `Failed to fetch candles for ${coin}`
        this.store.getState().addError(msg)
      }
      // Small delay between requests
      await sleep(200)
    }

    // When display interval is NOT 1h, separately fetch 1h candles for setup resolution
    if (this.interval !== SETUP_RESOLUTION_INTERVAL) {
      await this.fetchResolutionCandles()
    }
  }

  private async fetchResolutionCandles(): Promise<void> {
    const now = Date.now()
    const startTime = now - SETUP_RESOLUTION_LOOKBACK_MS

    for (const coin of TRACKED_COINS) {
      try {
        const rawCandles = await fetchCandles(coin, SETUP_RESOLUTION_INTERVAL, startTime, now)
        const candles = rawCandles.map(parseCandle)
        this.store.getState().setResolutionCandles(coin, candles)
      } catch {
        // Non-critical: resolution will fall back to display candles
      }
      await sleep(200)
    }
  }

  private async fetchAllFundingHistory(): Promise<void> {
    const now = Date.now()
    const startTime = now - this.itvl.fundingLookbackMs

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
      // Fetch extended candles for the display interval
      const existingCandles = state.candles[coin] ?? []
      const oldestCandleTime = existingCandles.length > 0 ? existingCandles[0]!.time : Date.now()
      if (oldestTime < oldestCandleTime) {
        try {
          const startTime = oldestTime - this.itvl.ms
          const rawCandles = await fetchCandles(coin, this.interval, startTime, oldestCandleTime)
          const candles = rawCandles.map(parseCandle)
          if (candles.length > 0) {
            this.store.getState().setExtendedCandles(coin, candles)
          }
        } catch {
          // Non-critical
        }
        await sleep(200)
      }

      // Always fetch 1h candles for resolution if not already 1h
      if (this.interval !== SETUP_RESOLUTION_INTERVAL) {
        const resCandles = state.resolutionCandles[coin] ?? []
        const oldestResTime = resCandles.length > 0 ? resCandles[0]!.time : Date.now()
        if (oldestTime < oldestResTime) {
          try {
            const startTime = oldestTime - 3_600_000
            const rawCandles = await fetchCandles(coin, SETUP_RESOLUTION_INTERVAL, startTime, oldestResTime)
            const candles = rawCandles.map(parseCandle)
            if (candles.length > 0) {
              const merged = [...candles, ...resCandles]
              const deduped = [...new Map(merged.map((c) => [c.time, c])).values()].sort((a, b) => a.time - b.time)
              this.store.getState().setResolutionCandles(coin, deduped)
            }
          } catch {
            // Non-critical
          }
          await sleep(200)
        }
      }
    }

    this.store.getState().resolveSetupOutcomes()
  }

  private async fetchServerSetups(): Promise<void> {
    const state = this.store.getState()

    try {
      const latestLocalSetupAt = state.trackedSetups.reduce(
        (latest, tracked) => Math.max(latest, tracked.setup.generatedAt),
        0,
      )
      const params = new URLSearchParams()
      if (latestLocalSetupAt > 0) {
        params.set('since', new Date(latestLocalSetupAt + 1).toISOString())
      } else {
        params.set('days', '7')
      }

      const res = await fetch(`/api/server-setups?${params.toString()}`)
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
    const gapPeriods = (now - lastComputed) / this.itvl.ms

    // Less than 2 periods: live computation will cover it
    if (gapPeriods < 2) {
      return
    }

    // Fetch extended candles if gap exceeds the standard window
    const { candleCount } = this.itvl
    if (gapPeriods > candleCount) {
      await this.fetchExtendedCandlesForBackfill(Math.ceil(gapPeriods) + candleCount)
    }

    // Fetch extended funding history covering the gap
    if (gapPeriods <= 200) {
      await this.fetchExtendedFundingForBackfill(lastComputed)
    }

    const timestamps = generateBackfillTimestamps(lastComputed, now, this.itvl.ms)
    if (timestamps.length === 0) return

    // Re-read state after fetches so we use freshly fetched data
    const freshState = this.store.getState()

    for (const coin of TRACKED_COINS) {
      const candles = freshState.candles[coin]
      const fundingHistory = freshState.fundingHistory[coin]
      const oiHistory = freshState.oiHistory[coin]

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

  private async fetchExtendedCandlesForBackfill(periodsNeeded: number): Promise<void> {
    const now = Date.now()
    const startTime = now - periodsNeeded * this.itvl.ms

    for (const coin of TRACKED_COINS) {
      try {
        const rawCandles = await fetchCandles(coin, this.interval, startTime, now)
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
    const { ms, candleCount } = this.itvl

    if (candleAge <= ms) {
      return
    }

    const startTime = now - candleCount * ms
    const rawCandles = await fetchCandles(coin, this.interval, startTime, now)
    const candles = rawCandles.map(parseCandle)
    this.store.getState().setCandles(coin, candles)
    if (this.interval === SETUP_RESOLUTION_INTERVAL) {
      this.store.getState().setResolutionCandles(coin, candles)
    }
  }

  private async refreshResolutionCandlesIfNeeded(coin: (typeof TRACKED_COINS)[number], now: number): Promise<void> {
    const latestCandle = this.store.getState().resolutionCandles[coin].slice(-1)[0]
    const candleAge = latestCandle ? now - latestCandle.time : Infinity

    if (candleAge <= 3_600_000) {
      return
    }

    const startTime = now - SETUP_RESOLUTION_LOOKBACK_MS
    const rawCandles = await fetchCandles(coin, SETUP_RESOLUTION_INTERVAL, startTime, now)
    const candles = rawCandles.map(parseCandle)
    this.store.getState().setResolutionCandles(coin, candles)
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
          if (this.interval !== SETUP_RESOLUTION_INTERVAL) {
            await this.refreshResolutionCandlesIfNeeded(coin, now)
          }
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
    }, POLL_INTERVAL_MS)
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

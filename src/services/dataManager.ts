import { TRACKED_COINS, parseCandle, type AssetContext } from '../types/market'
import {
  fetchAllMids,
  fetchMetaAndAssetCtxs,
  fetchCandles,
  fetchFundingHistory,
  fetchFearGreed,
  fetchCoinGeckoGlobal,
  fetchBinanceFundingRate,
  fetchBinanceOpenInterest,
  fetchServerSetups,
  uploadLocalSetups,
} from './api'
import { HyperliquidWS } from './websocket'
import { computeSignalsAtTime, generateBackfillTimestamps } from '../signals/backfill'
import { computeSuggestedSetup } from '../signals/setup'
import { INTERVAL_CONFIG } from '../config/intervals'
import type { StoreApi } from 'zustand'
import type { AppStore } from '../store'

import { POLL_INTERVAL_MS, SETUP_RESOLUTION_INTERVAL, SETUP_RESOLUTION_LOOKBACK_MS } from '../config/constants'
import { buildSetupId } from '../utils/identity'
import type { TrackedCoin } from '../types/market'

const FEAR_GREED_REFRESH_MS = 15 * 60 * 1000
const CRYPTO_MACRO_REFRESH_MS = 5 * 60 * 1000
const BINANCE_CONTEXT_REFRESH_MS = 2 * 60 * 1000
const SERVER_SETUP_REFRESH_MS = 5 * 60 * 1000
const NETWORK_FETCH_CONCURRENCY = 2
const NETWORK_REQUEST_GAP_MS = 80

export class DataManager {
  private ws: HyperliquidWS
  private store: StoreApi<AppStore>
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private unsubscribers: (() => void)[] = []
  private initialized = false
  private contextRefreshing = false
  private serverSetupRefreshing = false
  private setupSyncInFlight = false
  private pendingSetupUploadIds = new Set<string>()
  private lastServerSetupFetchAt: string | null = null
  private lastServerSetupRefreshAttemptAt = 0
  private bootstrapBackfillInFlight = false

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
      this.runCoreSignalPipeline()
      void this.fetchServerSetupHistory()

      // Fetch external context (non-blocking — failures don't affect core data)
      void this.fetchAllExternalContext()
      void this.runDeferredStartupBackfills()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch initial data'
      this.store.getState().addError(msg)
    }

    // Start polling for fresh funding/OI
    this.startPolling()
  }

  private runCoreSignalPipeline(): void {
    const state = this.store.getState()
    state.computeAllSignals()
    state.generateAllSetups()
    state.trackAllDecisionSnapshots()
    state.resolveSetupOutcomes()
    state.pruneSetupHistory()
    state.resolveTrackedOutcomes()
    state.pruneTrackerHistory()
  }

  private async runDeferredStartupBackfills(): Promise<void> {
    if (this.bootstrapBackfillInFlight) return

    this.bootstrapBackfillInFlight = true
    try {
      await this.backfillMissedSetups()
      await this.backfillCandlesForPendingSetups()
      this.runCoreSignalPipeline()
    } catch {
      // Non-critical: app remains live even if extended backfill fails
    } finally {
      this.bootstrapBackfillInFlight = false
    }
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

    await runWithConcurrency(TRACKED_COINS, NETWORK_FETCH_CONCURRENCY, async (coin) => {
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
      await sleep(NETWORK_REQUEST_GAP_MS)
    })

    // When display interval is NOT 1h, separately fetch 1h candles for setup resolution
    if (this.interval !== SETUP_RESOLUTION_INTERVAL) {
      await this.fetchResolutionCandles()
    }
  }

  private async fetchResolutionCandles(): Promise<void> {
    const now = Date.now()
    const startTime = now - SETUP_RESOLUTION_LOOKBACK_MS

    await runWithConcurrency(TRACKED_COINS, NETWORK_FETCH_CONCURRENCY, async (coin) => {
      try {
        const rawCandles = await fetchCandles(coin, SETUP_RESOLUTION_INTERVAL, startTime, now)
        const candles = rawCandles.map(parseCandle)
        this.store.getState().setResolutionCandles(coin, candles)
      } catch {
        // Non-critical: resolution will fall back to display candles
      }
      await sleep(NETWORK_REQUEST_GAP_MS)
    })
  }

  private async fetchAllFundingHistory(): Promise<void> {
    const now = Date.now()
    const startTime = now - this.itvl.fundingLookbackMs

    await runWithConcurrency(TRACKED_COINS, NETWORK_FETCH_CONCURRENCY, async (coin) => {
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
      await sleep(NETWORK_REQUEST_GAP_MS)
    })
  }

  private async fetchServerSetupHistory(): Promise<void> {
    try {
      const response = await fetchServerSetups(
        this.lastServerSetupFetchAt
          ? { updatedSince: this.lastServerSetupFetchAt }
          : undefined,
      )

      if (response.fetchedAt) {
        this.lastServerSetupFetchAt = response.fetchedAt
      }

      if (response.truncated) {
        this.store.getState().addError(
          `Canonical setup history is partial because the server fetch ceiling (${response.maxRowsApplied ?? response.rowCount}) was reached.`,
        )
      }

      if (response.setups.length > 0) {
        this.store.getState().hydrateServerSetups(response.setups)
      }

      // Auto-sync: push local-only setups to the server so all devices converge
      void this.syncLocalSetupsToServer()
    } catch {
      // Non-critical: the dashboard still works with browser-local fallback history if server hydration fails.
    }
  }

  private shouldRefreshServerSetupHistory(now: number): boolean {
    return now - this.lastServerSetupRefreshAttemptAt >= SERVER_SETUP_REFRESH_MS
  }

  private async refreshServerSetupHistoryIfNeeded(now: number): Promise<void> {
    if (this.serverSetupRefreshing || !this.shouldRefreshServerSetupHistory(now)) {
      return
    }

    this.serverSetupRefreshing = true
    this.lastServerSetupRefreshAttemptAt = now
    try {
      await this.fetchServerSetupHistory()
    } finally {
      this.serverSetupRefreshing = false
    }
  }

  private async syncLocalSetupsToServer(): Promise<void> {
    if (this.setupSyncInFlight) return

    try {
      this.setupSyncInFlight = true
      const state = this.store.getState()
      const { localTrackedSetups, serverTrackedSetups } = state

      if (localTrackedSetups.length === 0) return

      // Find local setups not already on the server (same dedup as useSetupHistorySource)
      const serverIds = new Set(serverTrackedSetups.map((s) => s.id))
      const serverKeys = new Set(serverTrackedSetups.map((s) => buildSetupId(s.setup)))
      const localOnly = localTrackedSetups.filter(
        (l) =>
          l.syncEligible === true &&
          !this.pendingSetupUploadIds.has(l.id) &&
          !serverIds.has(l.id) &&
          !serverKeys.has(buildSetupId(l.setup)),
      )

      if (localOnly.length === 0) return

      localOnly.forEach((tracked) => this.pendingSetupUploadIds.add(tracked.id))
      const result = await uploadLocalSetups(localOnly)
      if (result.synced > 0) {
        // Re-fetch server setups to hydrate the newly synced data
        const fresh = await fetchServerSetups()
        if (fresh.setups.length > 0) {
          this.store.getState().hydrateServerSetups(fresh.setups)
        }
      }
    } catch {
      // Non-critical: sync failure doesn't break the app
    } finally {
      this.pendingSetupUploadIds.clear()
      this.setupSyncInFlight = false
    }
  }

  private async backfillCandlesForPendingSetups(): Promise<void> {
    const state = this.store.getState()
    const pendingSetups = [...state.serverTrackedSetups, ...state.localTrackedSetups].filter((tracked) =>
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
        const assetByCoin = mapAssetContextsByCoin(universe, assetCtxs)
        await runWithConcurrency(TRACKED_COINS, NETWORK_FETCH_CONCURRENCY, async (coin) => {
          try {
            const ctx = assetByCoin[coin]
            if (ctx) {
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
          } catch {
            // Per-coin failures should not cancel the full polling cycle.
          }
        })

        // Trigger signal recomputation, generate setups for all coins, and resolve outcomes
        this.runCoreSignalPipeline()

        void this.refreshServerSetupHistoryIfNeeded(now)

        // Refresh external context at independent cadences
        this.refreshExternalContextIfNeeded()
      } catch {
        // Polling errors are non-fatal — next poll will try again
      }
    }, POLL_INTERVAL_MS)
  }

  // ── External context fetching ───────────────────────────────────────

  private async fetchFearGreedContext(): Promise<void> {
    try {
      const data = await fetchFearGreed()
      this.store.getState().setFearGreed({
        value: data.value,
        classification: data.classification,
        timestamp: Date.now(),
        source: 'alternative-me',
      })
    } catch {
      // Non-critical: sentiment panel will show unknown state
    }
  }

  private async fetchCryptoMacroContext(): Promise<void> {
    try {
      const data = await fetchCoinGeckoGlobal()
      const altSeasonBias =
        data.btcDominance !== null && data.btcDominance >= 56
          ? ('btc-headwind' as const)
          : data.btcDominance !== null && data.btcDominance <= 52 && (data.marketCapChange24h ?? 0) > 0
            ? ('alt-tailwind' as const)
            : ('neutral' as const)

      this.store.getState().setCryptoMacro({
        btcDominance: data.btcDominance,
        totalMarketCapUsd: data.totalMarketCapUsd,
        totalVolumeUsd: data.totalVolumeUsd,
        marketCapChange24h: data.marketCapChange24h,
        altSeasonBias,
        timestamp: Date.now(),
        source: 'coingecko',
      })
    } catch {
      // Non-critical: macro panel will show unknown state
    }
  }

  private async fetchBinanceContext(): Promise<void> {
    try {
      const state = this.store.getState()
      const fundingRate = {} as Record<TrackedCoin, number | null>
      const openInterestUsd = {} as Record<TrackedCoin, number | null>
      const fundingVsHyperliquid = {} as Record<TrackedCoin, number | null>
      const oiVsHyperliquid = {} as Record<TrackedCoin, number | null>

      await Promise.all(
        TRACKED_COINS.map(async (coin) => {
          const [binFunding, binOi] = await Promise.all([
            fetchBinanceFundingRate(coin),
            fetchBinanceOpenInterest(coin),
          ])

          fundingRate[coin] = binFunding
          openInterestUsd[coin] = binOi

          // Compute funding divergence vs Hyperliquid
          const hlFunding = state.signals[coin]?.funding?.currentRate ?? null
          if (binFunding !== null && hlFunding !== null) {
            fundingVsHyperliquid[coin] = binFunding - hlFunding
          } else {
            fundingVsHyperliquid[coin] = null
          }

          // Compute OI divergence vs Hyperliquid
          const hlOiStr = state.assetContexts[coin]?.openInterest
          const hlOi = hlOiStr ? parseFloat(hlOiStr) : null
          const hlPrice = state.prices[coin]
          const hlOiUsd = hlOi !== null && hlPrice !== null && isFinite(hlOi) && isFinite(hlPrice)
            ? hlOi * hlPrice
            : null
          if (binOi !== null && hlOiUsd !== null) {
            oiVsHyperliquid[coin] = binOi - hlOiUsd
          } else {
            oiVsHyperliquid[coin] = null
          }
        }),
      )

      this.store.getState().setBinanceContext({
        fundingRate,
        openInterestUsd,
        fundingVsHyperliquid,
        oiVsHyperliquid,
        timestamp: Date.now(),
        source: 'binance',
      })
    } catch {
      // Non-critical: Binance panel will show unknown state
    }
  }

  async fetchAllExternalContext(): Promise<void> {
    await Promise.all([
      this.fetchFearGreedContext(),
      this.fetchCryptoMacroContext(),
      this.fetchBinanceContext(),
    ])
  }

  private shouldRefreshContext(lastTimestamp: number | null, intervalMs: number): boolean {
    if (lastTimestamp === null) return true
    return Date.now() - lastTimestamp >= intervalMs
  }

  private async refreshExternalContextIfNeeded(): Promise<void> {
    if (this.contextRefreshing) return
    this.contextRefreshing = true
    try {
      const state = this.store.getState()
      const tasks: Promise<void>[] = []

      if (this.shouldRefreshContext(state.fearGreed.timestamp, FEAR_GREED_REFRESH_MS)) {
        tasks.push(this.fetchFearGreedContext())
      }
      if (this.shouldRefreshContext(state.cryptoMacro.timestamp, CRYPTO_MACRO_REFRESH_MS)) {
        tasks.push(this.fetchCryptoMacroContext())
      }
      if (this.shouldRefreshContext(state.binanceContext.timestamp, BINANCE_CONTEXT_REFRESH_MS)) {
        tasks.push(this.fetchBinanceContext())
      }

      if (tasks.length > 0) {
        await Promise.all(tasks)
      }
    } finally {
      this.contextRefreshing = false
    }
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
    this.serverSetupRefreshing = false
    this.lastServerSetupFetchAt = null
    this.lastServerSetupRefreshAttemptAt = 0
    this.bootstrapBackfillInFlight = false
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function mapAssetContextsByCoin(
  universe: Array<{ name: string }>,
  assetCtxs: AssetContext[],
): Partial<Record<TrackedCoin, AssetContext>> {
  const mapped: Partial<Record<TrackedCoin, AssetContext>> = {}
  for (const coin of TRACKED_COINS) {
    const idx = universe.findIndex((entry) => entry.name === coin)
    if (idx >= 0) {
      const ctx = assetCtxs[idx]
      if (ctx) mapped[coin] = ctx
    }
  }
  return mapped
}

async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return

  let cursor = 0
  const workerCount = Math.max(1, Math.min(concurrency, items.length))
  const jobs = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      await worker(items[index] as T)
    }
  })
  await Promise.all(jobs)
}

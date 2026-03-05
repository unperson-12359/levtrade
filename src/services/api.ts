import type { RawCandle, AssetContext, MetaResponse, FundingHistoryEntry, TrackedCoin } from '../types/market'
import type { TrackedSetup } from '../types/setup'
import type { CollectorHeartbeat } from '../types/collector'
import type { TrackerStats } from '../types/tracker'
import {
  CONTRACT_VERSION_V1,
  isContractMetaV1,
  isExecutionEventV1,
  type BacktestResultV1,
  type ContractMetaV1,
  type ExecutionEventV1,
  type LivePerformanceSnapshotV1,
} from '../contracts/v1'

const API_URL = 'https://api.hyperliquid.xyz/info'
const CORE_API_TIMEOUT_MS = 9_000
const EXTERNAL_API_TIMEOUT_MS = 6_000
const INTERNAL_API_TIMEOUT_MS = 8_000

// Binance perpetual symbol mapping — HYPE is not listed on Binance
const BINANCE_SYMBOL_MAP: Record<TrackedCoin, string | null> = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  SOL: 'SOLUSDT',
  HYPE: null,
}

async function postInfo<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetchWithTimeout(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, CORE_API_TIMEOUT_MS)
  if (!res.ok) {
    throw new Error(`Hyperliquid API error: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

/** Fetch mid prices for all assets. Returns { "BTC": "95000.50", ... } */
export async function fetchAllMids(): Promise<Record<string, string>> {
  return postInfo<Record<string, string>>({ type: 'allMids' })
}

/** Fetch meta + asset contexts. Returns [meta, assetCtx[]] */
export async function fetchMetaAndAssetCtxs(): Promise<[MetaResponse, AssetContext[]]> {
  const raw = await postInfo<[MetaResponse, AssetContext[]]>({ type: 'metaAndAssetCtxs' })
  return raw
}

/** Fetch candle data for a coin. Max 5000 candles per request. */
export async function fetchCandles(
  coin: string,
  interval: string,
  startTime: number,
  endTime?: number,
): Promise<RawCandle[]> {
  const req: Record<string, unknown> = { coin, interval, startTime }
  if (endTime !== undefined) req.endTime = endTime
  return postInfo<RawCandle[]>({ type: 'candleSnapshot', req })
}

/** Fetch funding rate history for a coin */
export async function fetchFundingHistory(
  coin: string,
  startTime: number,
  endTime?: number,
): Promise<FundingHistoryEntry[]> {
  const body: Record<string, unknown> = { type: 'fundingHistory', coin, startTime }
  if (endTime !== undefined) body.endTime = endTime
  return postInfo<FundingHistoryEntry[]>(body)
}

// ── External Context APIs ──────────────────────────────────────────────

/** Fetch Fear & Greed Index from alternative.me */
export async function fetchFearGreed(): Promise<{
  value: number
  classification: string
  timestamp: number
}> {
  const res = await fetchWithTimeout('https://api.alternative.me/fng/?limit=1', undefined, EXTERNAL_API_TIMEOUT_MS)
  if (!res.ok) throw new Error(`Fear & Greed API error: ${res.status}`)
  const json = (await res.json()) as { data?: Array<{ value: string; value_classification: string; timestamp: string }> }
  const entry = json.data?.[0]
  if (!entry) throw new Error('Fear & Greed API returned no data')
  return {
    value: parseInt(entry.value, 10),
    classification: entry.value_classification,
    timestamp: parseInt(entry.timestamp, 10) * 1000,
  }
}

/** Fetch global crypto market data from CoinGecko */
export async function fetchCoinGeckoGlobal(): Promise<{
  btcDominance: number | null
  totalMarketCapUsd: number | null
  totalVolumeUsd: number | null
  marketCapChange24h: number | null
}> {
  const res = await fetchWithTimeout('https://api.coingecko.com/api/v3/global', undefined, EXTERNAL_API_TIMEOUT_MS)
  if (!res.ok) throw new Error(`CoinGecko API error: ${res.status}`)
  const json = (await res.json()) as {
    data?: {
      market_cap_percentage?: Record<string, number>
      total_market_cap?: Record<string, number>
      total_volume?: Record<string, number>
      market_cap_change_percentage_24h_usd?: number
    }
  }
  const d = json.data
  return {
    btcDominance: d?.market_cap_percentage?.btc ?? null,
    totalMarketCapUsd: d?.total_market_cap?.usd ?? null,
    totalVolumeUsd: d?.total_volume?.usd ?? null,
    marketCapChange24h: d?.market_cap_change_percentage_24h_usd ?? null,
  }
}

// Binance Futures endpoints are called directly from the browser.
// If Binance blocks CORS, these will silently return null and the UI degrades to "--".
// This is acceptable — the panel is advisory context, not a critical data path.

/** Fetch Binance perpetual funding rate for a tracked coin. Returns null if unsupported. */
export async function fetchBinanceFundingRate(coin: TrackedCoin): Promise<number | null> {
  const symbol = BINANCE_SYMBOL_MAP[coin]
  if (!symbol) return null
  const res = await fetchWithTimeout(
    `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`,
    undefined,
    EXTERNAL_API_TIMEOUT_MS,
  )
  if (!res.ok) return null
  const json = (await res.json()) as { lastFundingRate?: string }
  const rate = parseFloat(json.lastFundingRate ?? '')
  return isFinite(rate) ? rate : null
}

/** Fetch Binance perpetual open interest for a tracked coin. Returns USD notional or null. */
export async function fetchBinanceOpenInterest(coin: TrackedCoin): Promise<number | null> {
  const symbol = BINANCE_SYMBOL_MAP[coin]
  if (!symbol) return null
  const res = await fetchWithTimeout(
    `https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`,
    undefined,
    EXTERNAL_API_TIMEOUT_MS,
  )
  if (!res.ok) return null
  const json = (await res.json()) as { openInterest?: string }
  const oi = parseFloat(json.openInterest ?? '')
  if (!isFinite(oi)) return null

  // Convert from coin units to USD using mark price — return null if conversion fails
  const priceRes = await fetchWithTimeout(
    `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`,
    undefined,
    EXTERNAL_API_TIMEOUT_MS,
  )
  if (!priceRes.ok) return null
  const priceJson = (await priceRes.json()) as { markPrice?: string }
  const markPrice = parseFloat(priceJson.markPrice ?? '')
  return isFinite(markPrice) ? oi * markPrice : null
}

export interface ServerSetupsResponse {
  setups: TrackedSetup[]
  rowCount: number
  truncated: boolean
  fetchedAt: string | null
  maxRowsApplied: number | null
  latestGeneratedAt: string | null
  meta: ContractMetaV1 | null
}

export async function fetchServerSetups(options?: {
  since?: string
  updatedSince?: string
}): Promise<ServerSetupsResponse> {
  try {
    const params = new URLSearchParams()
    if (options?.since) {
      params.set('since', options.since)
    }
    if (options?.updatedSince) {
      params.set('updatedSince', options.updatedSince)
    }

    const res = await fetchWithTimeout(
      `/api/server-setups${params.size > 0 ? `?${params.toString()}` : ''}`,
      undefined,
      INTERNAL_API_TIMEOUT_MS,
    )
    if (!res.ok) {
      return {
        setups: [],
        rowCount: 0,
        truncated: false,
        fetchedAt: null,
        maxRowsApplied: null,
        latestGeneratedAt: null,
        meta: null,
      }
    }

    const payload = (await res.json()) as {
      ok?: boolean
      contractVersion?: string
      setups?: TrackedSetup[]
      rowCount?: number
      truncated?: boolean
      fetchedAt?: string
      maxRowsApplied?: number | null
      latestGeneratedAt?: string | null
      meta?: unknown
    }
    if (payload.ok && Array.isArray(payload.setups)) {
      return {
        setups: payload.setups,
        rowCount: payload.rowCount ?? payload.setups.length,
        truncated: payload.truncated ?? false,
        fetchedAt: payload.fetchedAt ?? null,
        maxRowsApplied: payload.maxRowsApplied ?? null,
        latestGeneratedAt: payload.latestGeneratedAt ?? null,
        meta: parseContractMeta(payload.meta, payload.contractVersion),
      }
    }

    return {
      setups: [],
      rowCount: 0,
      truncated: false,
      fetchedAt: null,
      maxRowsApplied: null,
      latestGeneratedAt: null,
      meta: parseContractMeta(payload.meta, payload.contractVersion),
    }
  } catch {
    return {
      setups: [],
      rowCount: 0,
      truncated: false,
      fetchedAt: null,
      maxRowsApplied: null,
      latestGeneratedAt: null,
      meta: null,
    }
  }
}

export async function uploadLocalSetups(
  setups: TrackedSetup[],
): Promise<{ synced: number; skipped: number; rejected: number; disabled: boolean; reason?: string }> {
  const uploadSecret = import.meta.env.VITE_SETUP_UPLOAD_SECRET
  if (!uploadSecret) {
    return { synced: 0, skipped: setups.length, rejected: 0, disabled: true, reason: 'disabled' }
  }

  try {
    const res = await fetchWithTimeout('/api/upload-setups', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-levtrade-upload-secret': uploadSecret,
      },
      body: JSON.stringify({ setups }),
    }, INTERNAL_API_TIMEOUT_MS)
    if (!res.ok) {
      const reason = res.status === 401 || res.status === 403 ? 'unauthorized' : 'failed'
      return { synced: 0, skipped: setups.length, rejected: 0, disabled: false, reason }
    }
    const payload = (await res.json()) as {
      ok?: boolean
      synced?: number
      skipped?: number
      rejected?: number
      disabled?: boolean
      reason?: string
    }
    if (payload.ok) {
      return {
        synced: payload.synced ?? 0,
        skipped: payload.skipped ?? 0,
        rejected: payload.rejected ?? 0,
        disabled: payload.disabled ?? false,
        reason: payload.reason,
      }
    }
    return {
      synced: 0,
      skipped: setups.length,
      rejected: payload.rejected ?? 0,
      disabled: payload.disabled ?? false,
      reason: payload.reason ?? 'failed',
    }
  } catch {
    return { synced: 0, skipped: setups.length, rejected: 0, disabled: false, reason: 'failed' }
  }
}

export async function fetchCollectorHeartbeat(): Promise<(CollectorHeartbeat & { status: string }) | null> {
  const status = await fetchCollectorHeartbeatStatus()
  return status.heartbeat
}

export interface CollectorHeartbeatStatusResponse {
  heartbeat: (CollectorHeartbeat & { status: string }) | null
  error: string | null
  meta: ContractMetaV1 | null
}

export async function fetchCollectorHeartbeatStatus(): Promise<CollectorHeartbeatStatusResponse> {
  try {
    const res = await fetchWithTimeout('/api/collector-heartbeat', undefined, INTERNAL_API_TIMEOUT_MS)
    if (!res.ok) {
      return {
        heartbeat: null,
        error: `Collector heartbeat request failed with status ${res.status}.`,
        meta: null,
      }
    }

    const payload = (await res.json()) as {
      ok?: boolean
      contractVersion?: string
      heartbeat?: (CollectorHeartbeat & { status: string }) | null
      error?: string
      meta?: unknown
    }
    return {
      heartbeat: payload.ok ? (payload.heartbeat ?? null) : null,
      error: payload.ok ? null : (payload.error ?? 'Collector heartbeat is unavailable right now.'),
      meta: parseContractMeta(payload.meta, payload.contractVersion),
    }
  } catch {
    return {
      heartbeat: null,
      error: 'Collector heartbeat is unavailable right now.',
      meta: null,
    }
  }
}

export interface SignalAccuracyResponse {
  stats: TrackerStats | null
  error: string | null
  truncated: boolean
  recordCount: number
  windowDays: number
  computedAt: string | null
  meta: ContractMetaV1 | null
}

export async function fetchSignalAccuracy(days?: number): Promise<SignalAccuracyResponse> {
  try {
    const params = new URLSearchParams()
    if (days) params.set('days', String(days))
    const url = `/api/signal-accuracy${params.size > 0 ? `?${params.toString()}` : ''}`
    const res = await fetchWithTimeout(url, undefined, INTERNAL_API_TIMEOUT_MS)
    if (!res.ok) {
      return {
        stats: null,
        error: `Signal accuracy request failed with status ${res.status}.`,
        truncated: false,
        recordCount: 0,
        windowDays: days ?? 90,
        computedAt: null,
        meta: null,
      }
    }
    const payload = (await res.json()) as {
      ok?: boolean
      contractVersion?: string
      stats?: TrackerStats
      error?: string
      truncated?: boolean
      recordCount?: number
      windowDays?: number
      computedAt?: string
      meta?: unknown
    }
    if (payload.ok && payload.stats) {
      return {
        stats: payload.stats,
        error: null,
        truncated: payload.truncated ?? false,
        recordCount: payload.recordCount ?? 0,
        windowDays: payload.windowDays ?? (days ?? 90),
        computedAt: payload.computedAt ?? null,
        meta: parseContractMeta(payload.meta, payload.contractVersion),
      }
    }
    return {
      stats: null,
      error: payload.error ?? 'Signal accuracy is unavailable right now.',
      truncated: payload.truncated ?? false,
      recordCount: payload.recordCount ?? 0,
      windowDays: payload.windowDays ?? (days ?? 90),
      computedAt: payload.computedAt ?? null,
      meta: parseContractMeta(payload.meta, payload.contractVersion),
    }
  } catch {
    return {
      stats: null,
      error: 'Signal accuracy is unavailable right now.',
      truncated: false,
      recordCount: 0,
      windowDays: days ?? 90,
      computedAt: null,
      meta: null,
    }
  }
}

export interface PortfolioSnapshotResponse {
  snapshot: LivePerformanceSnapshotV1 | null
  error: string | null
  meta: ContractMetaV1 | null
}

export async function fetchPortfolioSnapshot(
  portfolioId: string = 'global',
  days?: number,
): Promise<PortfolioSnapshotResponse> {
  try {
    const params = new URLSearchParams()
    if (days) params.set('days', String(days))
    const url = `/api/portfolios/${encodeURIComponent(portfolioId)}/snapshot${params.size > 0 ? `?${params.toString()}` : ''}`
    const res = await fetchWithTimeout(url, undefined, INTERNAL_API_TIMEOUT_MS)
    if (!res.ok) {
      return {
        snapshot: null,
        error: `Portfolio snapshot request failed with status ${res.status}.`,
        meta: null,
      }
    }
    const payload = (await res.json()) as {
      ok?: boolean
      contractVersion?: string
      snapshot?: LivePerformanceSnapshotV1
      error?: string
      meta?: unknown
    }
    return {
      snapshot: payload.ok ? (payload.snapshot ?? null) : null,
      error: payload.ok ? null : (payload.error ?? 'Portfolio snapshot is unavailable right now.'),
      meta: parseContractMeta(payload.meta, payload.contractVersion),
    }
  } catch {
    return {
      snapshot: null,
      error: 'Portfolio snapshot is unavailable right now.',
      meta: null,
    }
  }
}

export interface BacktestResultResponse {
  result: BacktestResultV1 | null
  replayFingerprint: string | null
  error: string | null
  meta: ContractMetaV1 | null
}

export async function fetchBacktestResult(
  strategyId: string = 'mean-reversion-core',
  days?: number,
): Promise<BacktestResultResponse> {
  try {
    const params = new URLSearchParams()
    if (days) params.set('days', String(days))
    const url = `/api/strategies/${encodeURIComponent(strategyId)}/backtests${params.size > 0 ? `?${params.toString()}` : ''}`
    const res = await fetchWithTimeout(url, {
      method: 'GET',
    }, INTERNAL_API_TIMEOUT_MS)
    if (!res.ok) {
      return {
        result: null,
        replayFingerprint: null,
        error: `Backtest request failed with status ${res.status}.`,
        meta: null,
      }
    }
    const payload = (await res.json()) as {
      ok?: boolean
      contractVersion?: string
      result?: BacktestResultV1
      replayFingerprint?: string
      error?: string
      meta?: unknown
    }
    return {
      result: payload.ok ? (payload.result ?? null) : null,
      replayFingerprint: payload.ok ? (payload.replayFingerprint ?? null) : null,
      error: payload.ok ? null : (payload.error ?? 'Backtest is unavailable right now.'),
      meta: parseContractMeta(payload.meta, payload.contractVersion),
    }
  } catch {
    return {
      result: null,
      replayFingerprint: null,
      error: 'Backtest is unavailable right now.',
      meta: null,
    }
  }
}

export interface ExecutionEventsResponse {
  events: ExecutionEventV1[]
  error: string | null
  meta: ContractMetaV1 | null
}

export async function fetchExecutionEvents(): Promise<ExecutionEventsResponse> {
  try {
    const res = await fetchWithTimeout('/api/events/stream?mode=poll', undefined, INTERNAL_API_TIMEOUT_MS)
    if (!res.ok) {
      return {
        events: [],
        error: `Execution events request failed with status ${res.status}.`,
        meta: null,
      }
    }
    const payload = (await res.json()) as {
      ok?: boolean
      contractVersion?: string
      events?: unknown[]
      error?: string
      meta?: unknown
    }
    const events = Array.isArray(payload.events) ? payload.events.filter(isExecutionEventV1) : []
    return {
      events: payload.ok ? events : [],
      error: payload.ok ? null : (payload.error ?? 'Execution events are unavailable right now.'),
      meta: parseContractMeta(payload.meta, payload.contractVersion),
    }
  } catch {
    return {
      events: [],
      error: 'Execution events are unavailable right now.',
      meta: null,
    }
  }
}

function parseContractMeta(raw: unknown, contractVersion?: string): ContractMetaV1 | null {
  if (contractVersion !== CONTRACT_VERSION_V1) {
    return isContractMetaV1(raw) ? raw : null
  }
  return isContractMetaV1(raw) ? raw : null
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = CORE_API_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(input, {
      ...init,
      signal: controller.signal,
    })
    return res
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`Request timed out after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function isAbortError(error: unknown): boolean {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'AbortError'
  }

  if (error && typeof error === 'object') {
    const candidate = error as { name?: unknown }
    return candidate.name === 'AbortError'
  }

  return false
}

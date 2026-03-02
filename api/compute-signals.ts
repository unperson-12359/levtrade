// @ts-ignore — pre-bundled by esbuild during build step
import { TRACKED_COINS, parseCandle, computeHurst, computeZScore, computeFundingZScore, computeOIDelta, computeATR, computeRealizedVol, computeEntryGeometry, computeComposite, computeSuggestedSetup, resolveSetupWindow, emptyOutcome, SETUP_WINDOWS } from './_signals.mjs'
import type { TrackedCoin, Candle, FundingSnapshot, OISnapshot, RawCandle, FundingHistoryEntry } from '../src/types/market'
import type { AssetSignals } from '../src/types/signals'
import type { SuggestedSetup } from '../src/types/setup'
import type { SetupWindow, SetupOutcome } from '../src/types/setup'

const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info'
const COINALYZE_API = 'https://api.coinalyze.net/v1'
const MS_PER_HOUR = 3_600_000
const CANDLE_COUNT = 120
const FUNDING_WINDOW = 30
const OI_LOOKBACK_HOURS = 24
const SETUP_DEDUPE_WINDOW_MS = 4 * MS_PER_HOUR
const ENTRY_SIMILARITY_THRESHOLD = 0.02

// Coinalyze symbols for Hyperliquid (exchange code H)
const COINALYZE_SYMBOLS: Record<TrackedCoin, string> = {
  BTC: 'BTCUSD_PERP.H',
  ETH: 'ETHUSD_PERP.H',
  SOL: 'SOLUSD_PERP.H',
  HYPE: 'HYPEUSD_PERP.H',
}

interface CoinResult {
  coin: string
  ok: boolean
  error?: string
  setupGenerated: boolean
  setupId?: string
  outcomesResolved: number
}

interface VercelRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const secret = req.headers['x-cron-secret'] as string | undefined
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }

  const envError = validateEnv()
  if (envError) {
    return res.status(503).json({ ok: false, error: envError })
  }

  const now = Date.now()
  const results: CoinResult[] = []

  try {
    // Fetch prices and OI context for all coins at once
    const [mids, [meta, assetCtxs]] = await Promise.all([
      hlPost<Record<string, string>>({ type: 'allMids' }),
      hlPost<[{ universe: { name: string }[] }, { openInterest: string; funding: string }[]]>({
        type: 'metaAndAssetCtxs',
      }),
    ])

    // Process each coin sequentially (rate-limit friendly)
    for (const coin of TRACKED_COINS) {
      try {
        const result = await processCoin(coin, mids, meta.universe, assetCtxs, now)
        results.push(result)
      } catch (err) {
        results.push({
          coin,
          ok: false,
          error: err instanceof Error ? err.message : `Failed to process ${coin}`,
          setupGenerated: false,
          outcomesResolved: 0,
        })
      }
      await sleep(300)
    }

    return res.status(200).json({
      ok: true,
      processedAt: new Date(now).toISOString(),
      results,
    })
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Unexpected error',
    })
  }
}

async function processCoin(
  coin: TrackedCoin,
  mids: Record<string, string>,
  universe: { name: string }[],
  assetCtxs: { openInterest: string; funding: string }[],
  now: number,
): Promise<CoinResult> {
  // 1. Get current price
  const currentPrice = parseFloat(mids[coin] ?? '')
  if (!isFinite(currentPrice) || currentPrice <= 0) {
    return { coin, ok: false, error: 'No mid price', setupGenerated: false, outcomesResolved: 0 }
  }

  // 2. Store current OI snapshot in Supabase (self-accumulating backup)
  const coinIdx = universe.findIndex((u) => u.name === coin)
  if (coinIdx >= 0 && assetCtxs[coinIdx]) {
    const currentOI = parseFloat(assetCtxs[coinIdx]!.openInterest)
    if (isFinite(currentOI) && currentOI > 0) {
      await persistOISnapshot(coin, currentOI, now).catch(() => {})
    }
  }

  // 3. Fetch 120h candles from Hyperliquid
  const startTime = now - CANDLE_COUNT * MS_PER_HOUR
  const rawCandles = await hlPost<RawCandle[]>({
    type: 'candleSnapshot',
    req: { coin, interval: '1h', startTime, endTime: now },
  })
  const candles: Candle[] = rawCandles.map(parseCandle)

  if (candles.length < 20) {
    return { coin, ok: false, error: `Only ${candles.length} candles`, setupGenerated: false, outcomesResolved: 0 }
  }

  const closes = candles.map((c) => c.close)

  // 4. Fetch 30h funding history from Hyperliquid
  const fundingStart = now - FUNDING_WINDOW * MS_PER_HOUR
  const fundingEntries = await hlPost<FundingHistoryEntry[]>({
    type: 'fundingHistory',
    coin,
    startTime: fundingStart,
  })
  const fundingHistory: FundingSnapshot[] = fundingEntries
    .map((entry) => ({ time: entry.time, rate: parseFloat(entry.fundingRate) }))
    .filter((s) => isFinite(s.rate))

  // 5. Fetch OI history: try Coinalyze first, fall back to Supabase
  const oiHistory = await fetchOIFromCoinalyze(coin, now).catch(() => null)
    ?? await fetchOIFromSupabase(coin)

  // 6. Compute all signals
  const hurst = computeHurst(closes, 100)
  const zScore = computeZScore(closes, 20)
  const funding = computeFundingZScore(fundingHistory)
  const oiDelta = computeOIDelta(oiHistory, closes)
  const volResult = computeRealizedVol(closes)
  const atr = computeATR(candles)
  const volatility = { ...volResult, atr }
  const entryGeometry = computeEntryGeometry(closes, atr, 20)
  const composite = computeComposite(hurst, zScore, funding, oiDelta)

  const latestCandle = candles[candles.length - 1]
  const candleAge = latestCandle ? now - latestCandle.time : Infinity
  const isWarmingUp = candles.length < 100
  const isStale = candleAge > 2 * MS_PER_HOUR

  const signals: AssetSignals = {
    coin,
    hurst,
    zScore,
    funding,
    oiDelta,
    volatility,
    entryGeometry,
    composite,
    updatedAt: now,
    isStale,
    isWarmingUp,
    warmupProgress: Math.min(1, candles.length / 100),
  }

  // 7. Generate setup
  const setup = computeSuggestedSetup(coin, signals, currentPrice, {
    generatedAt: now,
    source: 'server',
  })

  let setupGenerated = false
  let setupId: string | undefined

  if (setup) {
    const isDuplicate = await checkDuplicate(coin, setup.direction, setup.entryPrice, now)
    if (!isDuplicate) {
      setupId = `${coin}-${setup.direction}-${now}-${randomSuffix()}`
      await persistServerSetup(setupId, coin, setup)
      setupGenerated = true
    }
  }

  // 8. Resolve outcomes for pending server setups using the candles we already have
  const outcomesResolved = await resolveServerOutcomes(coin, candles, now)

  return { coin, ok: true, setupGenerated, setupId, outcomesResolved }
}

// --- Hyperliquid API ---

async function hlPost<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(HYPERLIQUID_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`Hyperliquid API error: ${res.status}`)
  }
  return res.json() as Promise<T>
}

// --- Coinalyze API ---

async function fetchOIFromCoinalyze(coin: TrackedCoin, now: number): Promise<OISnapshot[]> {
  const apiKey = process.env.COINALYZE_API_KEY
  if (!apiKey) return []

  const symbol = COINALYZE_SYMBOLS[coin]
  const from = Math.floor((now - OI_LOOKBACK_HOURS * MS_PER_HOUR) / 1000)
  const to = Math.floor(now / 1000)

  const res = await fetch(
    `${COINALYZE_API}/open-interest-history?symbols=${symbol}&interval=hour_1&from=${from}&to=${to}`,
    { headers: { api_key: apiKey } },
  )

  if (!res.ok) {
    throw new Error(`Coinalyze API error: ${res.status}`)
  }

  const data = await res.json() as Array<{ history: Array<{ t: number; c: number }> }>
  if (!Array.isArray(data) || data.length === 0 || !Array.isArray(data[0]?.history)) {
    return []
  }

  return data[0]!.history.map((point) => ({
    time: point.t * 1000,
    oi: point.c,
  }))
}

// --- Supabase helpers ---

function supabaseHeaders(): Record<string, string> {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
    'Content-Type': 'application/json',
  }
}

function restBaseUrl(): string {
  return `${process.env.SUPABASE_URL!}/rest/v1`
}

async function persistOISnapshot(coin: string, oi: number, capturedAt: number): Promise<void> {
  await fetch(`${restBaseUrl()}/oi_snapshots`, {
    method: 'POST',
    headers: { ...supabaseHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify([{ coin, oi, captured_at: new Date(capturedAt).toISOString() }]),
  })
}

async function fetchOIFromSupabase(coin: string): Promise<OISnapshot[]> {
  try {
    const res = await fetch(
      `${restBaseUrl()}/oi_snapshots?coin=eq.${coin}&order=captured_at.desc&limit=24`,
      { headers: supabaseHeaders() },
    )
    if (!res.ok) return []

    const rows = (await res.json()) as Array<{ oi: number; captured_at: string }>
    return rows.reverse().map((row) => ({
      time: new Date(row.captured_at).getTime(),
      oi: row.oi,
    }))
  } catch {
    return []
  }
}

async function checkDuplicate(
  coin: string,
  direction: string,
  entryPrice: number,
  now: number,
): Promise<boolean> {
  try {
    const cutoff = new Date(now - SETUP_DEDUPE_WINDOW_MS).toISOString()
    const res = await fetch(
      `${restBaseUrl()}/server_setups?coin=eq.${coin}&direction=eq.${direction}&generated_at=gte.${cutoff}&order=generated_at.desc&limit=1`,
      { headers: supabaseHeaders() },
    )
    if (!res.ok) return false

    const rows = (await res.json()) as Array<{ setup_json: { entryPrice: number } }>
    if (rows.length === 0) return false

    const lastEntry = rows[0]!.setup_json.entryPrice
    const drift = Math.abs(lastEntry - entryPrice) / entryPrice
    return drift <= ENTRY_SIMILARITY_THRESHOLD
  } catch {
    return false
  }
}

async function persistServerSetup(id: string, coin: string, setup: SuggestedSetup): Promise<void> {
  const res = await fetch(`${restBaseUrl()}/server_setups`, {
    method: 'POST',
    headers: { ...supabaseHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify([{
      id,
      coin,
      direction: setup.direction,
      setup_json: setup,
      generated_at: new Date(setup.generatedAt).toISOString(),
    }]),
  })
  if (!res.ok) {
    throw new Error(`Failed to persist server setup: ${res.status}`)
  }
}

// --- Outcome resolution ---

async function resolveServerOutcomes(coin: string, candles: Candle[], now: number): Promise<number> {
  let resolved = 0
  try {
    // Fetch server setups for this coin that have pending outcomes (last 7 days)
    const cutoff = new Date(now - 7 * 24 * MS_PER_HOUR).toISOString()
    const res = await fetch(
      `${restBaseUrl()}/server_setups?coin=eq.${coin}&generated_at=gte.${cutoff}&order=generated_at.desc&limit=50`,
      { headers: supabaseHeaders() },
    )
    if (!res.ok) return 0

    const rows = (await res.json()) as Array<{
      id: string
      setup_json: SuggestedSetup
      outcomes_json: Record<SetupWindow, SetupOutcome> | null
    }>

    const windows: SetupWindow[] = ['4h', '24h', '72h']

    for (const row of rows) {
      const currentOutcomes: Record<SetupWindow, SetupOutcome> = row.outcomes_json ?? {
        '4h': emptyOutcome('4h'),
        '24h': emptyOutcome('24h'),
        '72h': emptyOutcome('72h'),
      }

      let changed = false
      const nextOutcomes = { ...currentOutcomes }

      for (const window of windows) {
        if (currentOutcomes[window].result !== 'pending') continue

        const outcome = resolveSetupWindow(row.setup_json, window, candles, now)
        if (outcome) {
          nextOutcomes[window] = outcome
          changed = true
        }
      }

      if (changed) {
        await updateSetupOutcomes(row.id, nextOutcomes)
        resolved++
      }
    }
  } catch {
    // Non-critical: outcomes will be resolved on next run
  }
  return resolved
}

async function updateSetupOutcomes(setupId: string, outcomes: Record<SetupWindow, SetupOutcome>): Promise<void> {
  await fetch(
    `${restBaseUrl()}/server_setups?id=eq.${setupId}`,
    {
      method: 'PATCH',
      headers: { ...supabaseHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({ outcomes_json: outcomes }),
    },
  )
}

// --- Utilities ---

function validateEnv(): string | null {
  if (!process.env.SUPABASE_URL) return 'SUPABASE_URL not configured'
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return 'SUPABASE_SERVICE_ROLE_KEY not configured'
  if (!process.env.CRON_SECRET) return 'CRON_SECRET not configured'
  return null
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

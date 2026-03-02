const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info'
const COINALYZE_API = 'https://api.coinalyze.net/v1'
const MS_PER_HOUR = 3_600_000
const CANDLE_COUNT = 120
const FUNDING_WINDOW = 30
const OI_LOOKBACK_HOURS = 24
const SETUP_DEDUPE_WINDOW_MS = 4 * MS_PER_HOUR
const ENTRY_SIMILARITY_THRESHOLD = 0.02

const COINALYZE_SYMBOLS: Record<string, string> = {
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
}

interface VercelRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

// Lazy-loaded signal modules (loaded once on first invocation)
let modules: {
  TRACKED_COINS: readonly string[]
  parseCandle: (raw: any) => any
  computeHurst: (closes: number[], period: number) => any
  computeZScore: (closes: number[], period: number) => any
  computeFundingZScore: (history: any[]) => any
  computeOIDelta: (oiHistory: any[], closes: number[]) => any
  computeATR: (candles: any[]) => any
  computeRealizedVol: (closes: number[]) => any
  computeEntryGeometry: (closes: number[], atr: any, period: number) => any
  computeComposite: (hurst: any, zScore: any, funding: any, oiDelta: any) => any
  computeSuggestedSetup: (coin: any, signals: any, price: number, options?: any) => any | null
} | null = null

async function loadModules() {
  if (modules) return modules

  const [market, hurst, zscore, funding, oiDelta, volatility, entryGeometry, composite, setup] =
    await Promise.all([
      import('../src/types/market'),
      import('../src/signals/hurst'),
      import('../src/signals/zscore'),
      import('../src/signals/funding'),
      import('../src/signals/oiDelta'),
      import('../src/signals/volatility'),
      import('../src/signals/entryGeometry'),
      import('../src/signals/composite'),
      import('../src/signals/setup'),
    ])

  modules = {
    TRACKED_COINS: market.TRACKED_COINS,
    parseCandle: market.parseCandle,
    computeHurst: hurst.computeHurst,
    computeZScore: zscore.computeZScore,
    computeFundingZScore: funding.computeFundingZScore,
    computeOIDelta: oiDelta.computeOIDelta,
    computeATR: volatility.computeATR,
    computeRealizedVol: volatility.computeRealizedVol,
    computeEntryGeometry: entryGeometry.computeEntryGeometry,
    computeComposite: composite.computeComposite,
    computeSuggestedSetup: setup.computeSuggestedSetup,
  }
  return modules
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

  let mod: NonNullable<typeof modules>
  try {
    mod = await loadModules()
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: 'Failed to load signal modules',
      detail: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
  }

  const now = Date.now()
  const results: CoinResult[] = []

  try {
    const [mids, [meta, assetCtxs]] = await Promise.all([
      hlPost<Record<string, string>>({ type: 'allMids' }),
      hlPost<[{ universe: { name: string }[] }, { openInterest: string; funding: string }[]]>({
        type: 'metaAndAssetCtxs',
      }),
    ])

    for (const coin of mod.TRACKED_COINS) {
      try {
        const result = await processCoin(mod, coin, mids, meta.universe, assetCtxs, now)
        results.push(result)
      } catch (err) {
        results.push({
          coin,
          ok: false,
          error: err instanceof Error ? err.message : `Failed to process ${coin}`,
          setupGenerated: false,
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
  mod: NonNullable<typeof modules>,
  coin: string,
  mids: Record<string, string>,
  universe: { name: string }[],
  assetCtxs: { openInterest: string; funding: string }[],
  now: number,
): Promise<CoinResult> {
  const currentPrice = parseFloat(mids[coin] ?? '')
  if (!isFinite(currentPrice) || currentPrice <= 0) {
    return { coin, ok: false, error: 'No mid price', setupGenerated: false }
  }

  const coinIdx = universe.findIndex((u) => u.name === coin)
  if (coinIdx >= 0 && assetCtxs[coinIdx]) {
    const currentOI = parseFloat(assetCtxs[coinIdx]!.openInterest)
    if (isFinite(currentOI) && currentOI > 0) {
      await persistOISnapshot(coin, currentOI, now).catch(() => {})
    }
  }

  const startTime = now - CANDLE_COUNT * MS_PER_HOUR
  const rawCandles = await hlPost<any[]>({
    type: 'candleSnapshot',
    req: { coin, interval: '1h', startTime, endTime: now },
  })
  const candles = rawCandles.map(mod.parseCandle)

  if (candles.length < 20) {
    return { coin, ok: false, error: `Only ${candles.length} candles`, setupGenerated: false }
  }

  const closes = candles.map((c: any) => c.close)

  const fundingStart = now - FUNDING_WINDOW * MS_PER_HOUR
  const fundingEntries = await hlPost<any[]>({
    type: 'fundingHistory',
    coin,
    startTime: fundingStart,
  })
  const fundingHistory = fundingEntries
    .map((entry: any) => ({ time: entry.time, rate: parseFloat(entry.fundingRate) }))
    .filter((s: any) => isFinite(s.rate))

  const oiHistory = await fetchOIFromCoinalyze(coin, now).catch(() => null)
    ?? await fetchOIFromSupabase(coin)

  const hurst = mod.computeHurst(closes, 100)
  const zScore = mod.computeZScore(closes, 20)
  const funding = mod.computeFundingZScore(fundingHistory)
  const oiDelta = mod.computeOIDelta(oiHistory, closes)
  const volResult = mod.computeRealizedVol(closes)
  const atr = mod.computeATR(candles)
  const volatility = { ...volResult, atr }
  const entryGeometry = mod.computeEntryGeometry(closes, atr, 20)
  const composite = mod.computeComposite(hurst, zScore, funding, oiDelta)

  const latestCandle = candles[candles.length - 1]
  const candleAge = latestCandle ? now - latestCandle.time : Infinity
  const isWarmingUp = candles.length < 100
  const isStale = candleAge > 2 * MS_PER_HOUR

  const signals = {
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

  const setup = mod.computeSuggestedSetup(coin, signals, currentPrice, {
    generatedAt: now,
    source: 'server',
  })

  if (!setup) {
    return { coin, ok: true, setupGenerated: false }
  }

  const isDuplicate = await checkDuplicate(coin, setup.direction, setup.entryPrice, now)
  if (isDuplicate) {
    return { coin, ok: true, setupGenerated: false }
  }

  const setupId = `${coin}-${setup.direction}-${now}-${randomSuffix()}`
  await persistServerSetup(setupId, coin, setup)

  return { coin, ok: true, setupGenerated: true, setupId }
}

// --- Hyperliquid API ---

async function hlPost<T>(body: Record<string, unknown>): Promise<T> {
  const r = await fetch(HYPERLIQUID_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    throw new Error(`Hyperliquid API error: ${r.status}`)
  }
  return r.json() as Promise<T>
}

// --- Coinalyze API ---

async function fetchOIFromCoinalyze(coin: string, now: number): Promise<Array<{ time: number; oi: number }>> {
  const apiKey = process.env.COINALYZE_API_KEY
  if (!apiKey) return []

  const symbol = COINALYZE_SYMBOLS[coin]
  if (!symbol) return []
  const from = Math.floor((now - OI_LOOKBACK_HOURS * MS_PER_HOUR) / 1000)
  const to = Math.floor(now / 1000)

  const r = await fetch(
    `${COINALYZE_API}/open-interest-history?symbols=${symbol}&interval=hour_1&from=${from}&to=${to}`,
    { headers: { api_key: apiKey } },
  )

  if (!r.ok) {
    throw new Error(`Coinalyze API error: ${r.status}`)
  }

  const data = await r.json() as Array<{ history: Array<{ t: number; c: number }> }>
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

async function fetchOIFromSupabase(coin: string): Promise<Array<{ time: number; oi: number }>> {
  try {
    const r = await fetch(
      `${restBaseUrl()}/oi_snapshots?coin=eq.${coin}&order=captured_at.desc&limit=24`,
      { headers: supabaseHeaders() },
    )
    if (!r.ok) return []

    const rows = (await r.json()) as Array<{ oi: number; captured_at: string }>
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
    const r = await fetch(
      `${restBaseUrl()}/server_setups?coin=eq.${coin}&direction=eq.${direction}&generated_at=gte.${cutoff}&order=generated_at.desc&limit=1`,
      { headers: supabaseHeaders() },
    )
    if (!r.ok) return false

    const rows = (await r.json()) as Array<{ setup_json: { entryPrice: number } }>
    if (rows.length === 0) return false

    const lastEntry = rows[0]!.setup_json.entryPrice
    const drift = Math.abs(lastEntry - entryPrice) / entryPrice
    return drift <= ENTRY_SIMILARITY_THRESHOLD
  } catch {
    return false
  }
}

async function persistServerSetup(id: string, coin: string, setup: any): Promise<void> {
  const r = await fetch(`${restBaseUrl()}/server_setups`, {
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
  if (!r.ok) {
    throw new Error(`Failed to persist server setup: ${r.status}`)
  }
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

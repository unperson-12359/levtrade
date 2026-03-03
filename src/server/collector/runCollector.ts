import {
  TRACKED_COINS,
  parseCandle,
  computeHurst,
  computeZScore,
  computeFundingZScore,
  computeOIDelta,
  computeATR,
  computeRealizedVol,
  computeEntryGeometry,
  computeComposite,
  computeSuggestedSetup,
  resolveSetupWindow,
  emptyOutcome,
  buildTrackedRecords,
  shouldTrackRecord,
  scoreDirection,
  emptySignalOutcome,
  TRACKER_WINDOWS,
} from '../../signals/api-entry'
import type {
  TrackedCoin,
  Candle,
  FundingSnapshot,
  OISnapshot,
  RawCandle,
  FundingHistoryEntry,
} from '../../types/market'
import type { AssetSignals } from '../../types/signals'
import type { SuggestedSetup, SetupOutcome, SetupWindow } from '../../types/setup'
import type { TrackedSignalRecord, TrackedSignalOutcome, TrackerWindow } from '../../types/tracker'
import type { CollectorCoinResult, CollectorRunResult } from '../../types/collector'
import { buildSetupId } from '../../utils/identity'
import { floorToHour } from '../../utils/candleTime'

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info'
const COINALYZE_API = 'https://api.coinalyze.net/v1'
const COLLECTOR_NAME = 'primary'
const GLOBAL_SCOPE = 'global'
const MS_PER_HOUR = 3_600_000
const CANDLE_COUNT = 120
const FUNDING_WINDOW = 30
const OI_LOOKBACK_HOURS = 24
const SETUP_DEDUPE_WINDOW_MS = 4 * MS_PER_HOUR
const SIGNAL_DEDUPE_WINDOW_MS = 4 * MS_PER_HOUR
const ENTRY_SIMILARITY_THRESHOLD = 0.02
const SIGNAL_DEDUPE_FETCH_LIMIT = 400
const SIGNAL_RESOLUTION_PAGE_SIZE = 500
const SIGNAL_RESOLUTION_MAX_ROWS = 5_000

const COINALYZE_SYMBOLS: Record<TrackedCoin, string> = {
  BTC: 'BTCUSD_PERP.H',
  ETH: 'ETHUSD_PERP.H',
  SOL: 'SOLUSD_PERP.H',
  HYPE: 'HYPEUSD_PERP.H',
}

export async function runCollector(now = Date.now()): Promise<CollectorRunResult> {
  const envError = validateCollectorEnv()
  if (envError) {
    await updateCollectorHeartbeat(now, envError).catch(() => {})
    throw new Error(envError)
  }

  await updateCollectorHeartbeat(now, null).catch(() => {})

  try {
    const [mids, [meta, assetCtxs]] = await Promise.all([
      hlPost<Record<string, string>>({ type: 'allMids' }),
      hlPost<[{ universe: { name: string }[] }, { openInterest: string; funding: string }[]]>({
        type: 'metaAndAssetCtxs',
      }),
    ])

    const results: CollectorCoinResult[] = []

    for (const coin of TRACKED_COINS) {
      try {
        const result = await processCoin(coin, mids, meta.universe, assetCtxs, now, GLOBAL_SCOPE)
        results.push(result)
      } catch (err) {
        results.push({
          coin,
          ok: false,
          error: err instanceof Error ? err.message : `Failed to process ${coin}`,
          setupGenerated: false,
          outcomesResolved: 0,
          signalsTracked: 0,
          signalsResolved: 0,
        })
      }
      await sleep(300)
    }

    await updateCollectorHeartbeat(now, null, now).catch(() => {})
    return { processedAt: now, results }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected collector error'
    await updateCollectorHeartbeat(now, message).catch(() => {})
    throw err
  }
}

async function processCoin(
  coin: TrackedCoin,
  mids: Record<string, string>,
  universe: { name: string }[],
  assetCtxs: { openInterest: string; funding: string }[],
  now: number,
  scope: string,
): Promise<CollectorCoinResult> {
  const currentPrice = parseFloat(mids[coin] ?? '')
  if (!isFinite(currentPrice) || currentPrice <= 0) {
    return { coin, ok: false, error: 'No mid price', setupGenerated: false, outcomesResolved: 0, signalsTracked: 0, signalsResolved: 0 }
  }

  const coinIdx = universe.findIndex((u) => u.name === coin)
  if (coinIdx >= 0 && assetCtxs[coinIdx]) {
    const currentOI = parseFloat(assetCtxs[coinIdx]!.openInterest)
    if (isFinite(currentOI) && currentOI > 0) {
      await persistOISnapshot(coin, currentOI, now).catch(() => {})
    }
  }

  const startTime = now - CANDLE_COUNT * MS_PER_HOUR
  const rawCandles = await hlPost<RawCandle[]>({
    type: 'candleSnapshot',
    req: { coin, interval: '1h', startTime, endTime: now },
  })
  const candles: Candle[] = rawCandles.map(parseCandle)
  if (candles.length < 20) {
    return { coin, ok: false, error: `Only ${candles.length} candles`, setupGenerated: false, outcomesResolved: 0, signalsTracked: 0, signalsResolved: 0 }
  }

  const fundingStart = now - FUNDING_WINDOW * MS_PER_HOUR
  const fundingEntries = await hlPost<FundingHistoryEntry[]>({
    type: 'fundingHistory',
    coin,
    startTime: fundingStart,
  })
  const fundingHistory: FundingSnapshot[] = fundingEntries
    .map((entry) => ({ time: entry.time, rate: parseFloat(entry.fundingRate) }))
    .filter((snapshot) => isFinite(snapshot.rate))

  const oiHistory = (await fetchOIFromCoinalyze(coin, now).catch(() => null)) ?? (await fetchOIFromSupabase(coin))

  const closes = candles.map((c) => c.close)
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

  const setup = computeSuggestedSetup(coin, signals, currentPrice, {
    generatedAt: now,
    source: 'server',
  })

  let setupGenerated = false
  let setupId: string | undefined
  if (setup) {
    const isDuplicate = await checkDuplicate(scope, coin, setup.direction, setup.entryPrice, now)
    if (!isDuplicate) {
      setupId = buildSetupId(setup)
      await persistServerSetup(setupId, scope, coin, setup)
      setupGenerated = true
    }
  }

  const outcomesResolved = await resolveServerOutcomes(scope, coin, candles, now)
  const signalResult = await trackSignalsForCoin(scope, coin, signals, currentPrice, candles, now)
  return { coin, ok: true, setupGenerated, setupId, outcomesResolved, signalsTracked: signalResult.tracked, signalsResolved: signalResult.resolved }
}

function validateCollectorEnv(): string | null {
  if (!env.SUPABASE_URL) return 'SUPABASE_URL not configured'
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return 'SUPABASE_SERVICE_ROLE_KEY not configured'
  return null
}

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

async function fetchOIFromCoinalyze(coin: TrackedCoin, now: number): Promise<OISnapshot[] | null> {
  const apiKey = env.COINALYZE_API_KEY
  if (!apiKey) return null

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

  const data = (await res.json()) as Array<{ history: Array<{ t: number; c: number }> }>
  if (!Array.isArray(data) || data.length === 0 || !Array.isArray(data[0]?.history) || data[0]!.history.length === 0) {
    return null
  }

  return data[0]!.history.map((point) => ({
    time: point.t * 1000,
    oi: point.c,
  }))
}

function supabaseHeaders(): Record<string, string> {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY!}`,
    'Content-Type': 'application/json',
  }
}

function restBaseUrl(): string {
  return `${env.SUPABASE_URL!}/rest/v1`
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
  scope: string,
  coin: string,
  direction: string,
  entryPrice: number,
  now: number,
): Promise<boolean> {
  try {
    const cutoff = new Date(now - SETUP_DEDUPE_WINDOW_MS).toISOString()
    const params = new URLSearchParams({
      scope: `eq.${scope}`,
      coin: `eq.${coin}`,
      direction: `eq.${direction}`,
      generated_at: `gte.${cutoff}`,
      order: 'generated_at.desc',
      limit: '1',
      select: 'setup_json',
    })
    const res = await fetch(`${restBaseUrl()}/server_setups?${params.toString()}`, {
      headers: supabaseHeaders(),
    })
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

async function persistServerSetup(id: string, scope: string, coin: string, setup: SuggestedSetup): Promise<void> {
  const outcomes = {
    '4h': emptyOutcome('4h'),
    '24h': emptyOutcome('24h'),
    '72h': emptyOutcome('72h'),
  }

  const res = await fetch(`${restBaseUrl()}/server_setups`, {
    method: 'POST',
    headers: { ...supabaseHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify([{
      id,
      scope,
      coin,
      direction: setup.direction,
      setup_json: setup,
      outcomes_json: outcomes,
      generated_at: new Date(setup.generatedAt).toISOString(),
      updated_at: new Date(setup.generatedAt).toISOString(),
    }]),
  })
  if (!res.ok) {
    throw new Error(`Failed to persist server setup: ${res.status}`)
  }
}

async function resolveServerOutcomes(scope: string, coin: string, candles: Candle[], now: number): Promise<number> {
  let resolved = 0
  try {
    const cutoff = new Date(now - 7 * 24 * MS_PER_HOUR).toISOString()
    const params = new URLSearchParams({
      scope: `eq.${scope}`,
      coin: `eq.${coin}`,
      generated_at: `gte.${cutoff}`,
      order: 'generated_at.desc',
      limit: '100',
      select: 'id,setup_json,outcomes_json',
    })
    const res = await fetch(`${restBaseUrl()}/server_setups?${params.toString()}`, {
      headers: supabaseHeaders(),
    })
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
        await updateSetupOutcomes(row.id, nextOutcomes, now)
        resolved += 1
      }
    }
  } catch {
    // Non-critical: outcomes will be resolved on a later run.
  }

  return resolved
}

async function updateSetupOutcomes(
  setupId: string,
  outcomes: Record<SetupWindow, SetupOutcome>,
  now: number,
): Promise<void> {
  await fetch(`${restBaseUrl()}/server_setups?id=eq.${setupId}`, {
    method: 'PATCH',
    headers: { ...supabaseHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({
      outcomes_json: outcomes,
      updated_at: new Date(now).toISOString(),
    }),
  })
}

async function updateCollectorHeartbeat(
  now: number,
  lastError: string | null,
  lastSuccessAt?: number,
): Promise<void> {
  const payload: Record<string, unknown> = {
    collector_name: COLLECTOR_NAME,
    last_run_at: new Date(now).toISOString(),
    last_error: lastError,
    updated_at: new Date(now).toISOString(),
  }

  if (lastSuccessAt !== undefined) {
    payload.last_success_at = new Date(lastSuccessAt).toISOString()
  }

  await fetch(`${restBaseUrl()}/collector_heartbeat?on_conflict=collector_name`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(),
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify([payload]),
  })
}

async function trackSignalsForCoin(
  scope: string,
  coin: TrackedCoin,
  signals: AssetSignals,
  referencePrice: number,
  candles: Candle[],
  now: number,
): Promise<{ tracked: number; resolved: number }> {
  try {
    if (!isFinite(referencePrice) || referencePrice <= 0 || signals.isWarmingUp || signals.isStale) {
      return { tracked: 0, resolved: 0 }
    }

    const records = buildTrackedRecords(coin, signals, referencePrice)
    const recentRecords = await fetchRecentTrackedSignals(scope, coin, now)
    const newRecords = records.filter((record) => shouldTrackRecord(record, recentRecords))

    let tracked = 0
    for (const record of newRecords) {
      await persistTrackedSignal(record.id, scope, coin, record, now)
      tracked++
    }

    const resolved = await resolveSignalOutcomes(scope, coin, candles, now)
    return { tracked, resolved }
  } catch {
    return { tracked: 0, resolved: 0 }
  }
}

async function fetchRecentTrackedSignals(
  scope: string,
  coin: string,
  now: number,
): Promise<TrackedSignalRecord[]> {
  try {
    const cutoff = new Date(now - SIGNAL_DEDUPE_WINDOW_MS).toISOString()
    const params = new URLSearchParams({
      scope: `eq.${scope}`,
      coin: `eq.${coin}`,
      recorded_at: `gte.${cutoff}`,
      order: 'recorded_at.desc',
      limit: String(SIGNAL_DEDUPE_FETCH_LIMIT),
      select: 'signal_json',
    })
    const res = await fetch(`${restBaseUrl()}/tracked_signals?${params.toString()}`, {
      headers: supabaseHeaders(),
    })
    if (!res.ok) return []
    const rows = (await res.json()) as Array<{ signal_json: TrackedSignalRecord }>
    return rows.map((r) => r.signal_json)
  } catch {
    return []
  }
}

async function persistTrackedSignal(
  id: string,
  scope: string,
  coin: string,
  record: TrackedSignalRecord,
  now: number,
): Promise<void> {
  const windows: TrackerWindow[] = ['4h', '24h', '72h']
  const outcomes: Record<string, TrackedSignalOutcome> = {}
  for (const w of windows) {
    outcomes[w] = { ...emptySignalOutcome(w), recordId: record.id }
  }

  await fetch(`${restBaseUrl()}/tracked_signals?on_conflict=id`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(),
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify([{
      id,
      scope,
      coin,
      kind: record.kind,
      direction: record.direction,
      signal_json: record,
      outcomes_json: outcomes,
      recorded_at: new Date(record.timestamp).toISOString(),
      updated_at: new Date(now).toISOString(),
    }]),
  })
}

async function resolveSignalOutcomes(
  scope: string,
  coin: string,
  candles: Candle[],
  now: number,
): Promise<number> {
  let resolved = 0
  try {
    const cutoff = new Date(now - 7 * 24 * MS_PER_HOUR).toISOString()
    const rows = await fetchTrackedSignalsForResolution(scope, coin, cutoff)

    const windows: TrackerWindow[] = ['4h', '24h', '72h']

    for (const row of rows) {
      const record = row.signal_json
      let changed = false
      const nextOutcomes = { ...row.outcomes_json }

      for (const window of windows) {
        const outcome = nextOutcomes[window]
        if (outcome.resolvedAt !== null) continue

        const targetTime = record.timestamp + TRACKER_WINDOWS[window]
        if (now < targetTime) continue

        const futurePrice = findSignalFuturePrice(candles, targetTime)
        if (futurePrice === null) continue

        const returnPct = ((futurePrice - record.referencePrice) / record.referencePrice) * 100
        const correct = scoreDirection(record.direction, returnPct)

        nextOutcomes[window] = {
          ...outcome,
          resolvedAt: now,
          futurePrice,
          returnPct,
          correct,
        }
        changed = true
      }

      if (changed) {
        await fetch(`${restBaseUrl()}/tracked_signals?id=eq.${row.id}`, {
          method: 'PATCH',
          headers: { ...supabaseHeaders(), Prefer: 'return=minimal' },
          body: JSON.stringify({
            outcomes_json: nextOutcomes,
            updated_at: new Date(now).toISOString(),
          }),
        })
        resolved++
      }
    }
  } catch {
    // Non-critical: outcomes will be resolved on a later run.
  }
  return resolved
}

async function fetchTrackedSignalsForResolution(
  scope: string,
  coin: string,
  cutoff: string,
): Promise<Array<{
  id: string
  signal_json: TrackedSignalRecord
  outcomes_json: Record<TrackerWindow, TrackedSignalOutcome>
}>> {
  const rows: Array<{
    id: string
    signal_json: TrackedSignalRecord
    outcomes_json: Record<TrackerWindow, TrackedSignalOutcome>
  }> = []

  for (let offset = 0; offset < SIGNAL_RESOLUTION_MAX_ROWS; offset += SIGNAL_RESOLUTION_PAGE_SIZE) {
    const params = new URLSearchParams({
      scope: `eq.${scope}`,
      coin: `eq.${coin}`,
      recorded_at: `gte.${cutoff}`,
      order: 'recorded_at.desc',
      limit: String(SIGNAL_RESOLUTION_PAGE_SIZE),
      offset: String(offset),
      select: 'id,signal_json,outcomes_json',
    })
    const res = await fetch(`${restBaseUrl()}/tracked_signals?${params.toString()}`, {
      headers: supabaseHeaders(),
    })
    if (!res.ok) {
      return rows
    }

    const page = (await res.json()) as Array<{
      id: string
      signal_json: TrackedSignalRecord
      outcomes_json: Record<TrackerWindow, TrackedSignalOutcome>
    }>

    rows.push(...page)
    if (page.length < SIGNAL_RESOLUTION_PAGE_SIZE) {
      break
    }
  }

  return rows
}

function findSignalFuturePrice(candles: Candle[], targetTime: number): number | null {
  const bucketTime = floorToHour(targetTime)
  const match = candles.find((c) => c.time === bucketTime)
  if (match && isFinite(match.close) && match.close > 0) {
    return match.close
  }
  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

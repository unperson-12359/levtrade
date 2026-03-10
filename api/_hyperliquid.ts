import { TRACKED_COINS, type RawCandle, type TrackedCoin } from './_signals.mjs'

export type ObservatoryInterval = '4h' | '1d'

const HYPERLIQUID_API = 'https://api.hyperliquid.xyz/info'
const REQUEST_TIMEOUT_MS = 12_000

export async function fetchAllMids(): Promise<Record<string, string>> {
  return postInfo<Record<string, string>>({ type: 'allMids' })
}

export async function fetchCandles(
  coin: TrackedCoin,
  interval: ObservatoryInterval,
  startTime: number,
  endTime: number,
): Promise<RawCandle[]> {
  return postInfo<RawCandle[]>({
    type: 'candleSnapshot',
    req: { coin, interval, startTime, endTime },
  })
}

export function resolveCoin(raw: string | string[] | undefined): TrackedCoin {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value && TRACKED_COINS.includes(value as TrackedCoin)) {
    return value as TrackedCoin
  }
  return 'BTC'
}

export function resolveObservatoryInterval(raw: string | string[] | undefined): ObservatoryInterval {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (value === '4h' || value === '1d') return value
  return '4h'
}

export function parsePositiveInteger(
  raw: string | string[] | undefined,
  fallback: number,
  options: { min?: number; max?: number } = {},
): number {
  const value = Array.isArray(raw) ? raw[0] : raw
  const parsed = Number.parseInt(value ?? '', 10)
  const candidate = Number.isFinite(parsed) ? parsed : fallback
  const min = options.min ?? 1
  const max = options.max ?? Number.MAX_SAFE_INTEGER
  return Math.max(min, Math.min(max, candidate))
}

async function postInfo<T>(body: Record<string, unknown>): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(HYPERLIQUID_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`Hyperliquid request failed: ${response.status}`)
    }

    return response.json() as Promise<T>
  } finally {
    clearTimeout(timer)
  }
}

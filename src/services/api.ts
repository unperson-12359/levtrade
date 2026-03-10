import type { RawCandle } from '../types/market'

const API_URL = 'https://api.hyperliquid.xyz/info'
const CORE_API_TIMEOUT_MS = 9_000

async function postInfo<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetchWithTimeout(
    API_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    CORE_API_TIMEOUT_MS,
  )
  if (!res.ok) {
    throw new Error(`Hyperliquid API error: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export async function fetchAllMids(): Promise<Record<string, string>> {
  return postInfo<Record<string, string>>({ type: 'allMids' })
}

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

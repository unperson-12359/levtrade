import type { RawCandle } from '../types/market'
import { postHyperliquidInfo } from '../shared/hyperliquid'

const CORE_API_TIMEOUT_MS = 9_000

export async function fetchAllMids(): Promise<Record<string, string>> {
  return postHyperliquidInfo<Record<string, string>>({ type: 'allMids' }, { timeoutMs: CORE_API_TIMEOUT_MS })
}

export async function fetchCandles(
  coin: string,
  interval: string,
  startTime: number,
  endTime?: number,
): Promise<RawCandle[]> {
  const req: Record<string, unknown> = { coin, interval, startTime }
  if (endTime !== undefined) req.endTime = endTime
  return postHyperliquidInfo<RawCandle[]>({ type: 'candleSnapshot', req }, { timeoutMs: CORE_API_TIMEOUT_MS })
}

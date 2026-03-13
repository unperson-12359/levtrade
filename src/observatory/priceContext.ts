export interface PriceContext {
  lastPrice: number | null
  change24hPct: number | null
  intervalReturnPct: number | null
  observedAt: string | null
}

interface PriceContextCandle {
  time: number
  close: number
}

export function buildPriceContext(input: {
  candles: PriceContextCandle[]
  interval: '1d'
  livePrice: number | null
  livePriceObservedAtMs?: number | null
  generatedAtMs?: number
}): PriceContext {
  const generatedAtMs = input.generatedAtMs ?? Date.now()
  const latestCandleTime = input.candles[input.candles.length - 1]?.time ?? null
  const latestClose = input.candles[input.candles.length - 1]?.close ?? null
  const lastPrice = Number.isFinite(input.livePrice) ? input.livePrice : latestClose
  const barsFor24h = 1
  const close24hAgo = input.candles[Math.max(0, input.candles.length - 1 - barsFor24h)]?.close ?? null
  const closePrevious = input.candles[Math.max(0, input.candles.length - 2)]?.close ?? null

  const change24hPct =
    lastPrice !== null && close24hAgo !== null && close24hAgo !== 0
      ? ((lastPrice - close24hAgo) / Math.abs(close24hAgo)) * 100
      : null
  const intervalReturnPct =
    lastPrice !== null && closePrevious !== null && closePrevious !== 0
      ? ((lastPrice - closePrevious) / Math.abs(closePrevious)) * 100
      : null

  const observedAtMs = Number.isFinite(lastPrice)
    ? input.livePriceObservedAtMs ?? latestCandleTime ?? generatedAtMs
    : latestCandleTime

  return {
    lastPrice,
    change24hPct,
    intervalReturnPct,
    observedAt: Number.isFinite(observedAtMs) ? new Date(observedAtMs as number).toISOString() : null,
  }
}

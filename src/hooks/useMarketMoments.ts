import { useMemo } from 'react'
import { buildMomentSnapshotFromHourlyCandles } from '../signals/marketMoments'
import { useStore } from '../store'
import type { TrackedCoin, Candle } from '../types/market'

export function useMarketMoments(coin: TrackedCoin) {
  const candles = useStore((state) => state.candles[coin])
  const resolutionCandles = useStore((state) => state.resolutionCandles[coin])
  const extendedCandles = useStore((state) => state.extendedCandles[coin])
  const lastUpdate = useStore((state) => state.lastUpdate)

  return useMemo(() => {
    const merged = mergeCandlesByTime(
      extendedCandles,
      resolutionCandles.length > 0 ? resolutionCandles : candles,
    )
    return buildMomentSnapshotFromHourlyCandles(merged, lastUpdate ?? Date.now())
  }, [candles, coin, extendedCandles, lastUpdate, resolutionCandles])
}

function mergeCandlesByTime(primary: Candle[], secondary: Candle[]): Candle[] {
  const map = new Map<number, Candle>()
  for (const candle of [...primary, ...secondary]) {
    map.set(candle.time, candle)
  }
  return [...map.values()].sort((left, right) => left.time - right.time)
}

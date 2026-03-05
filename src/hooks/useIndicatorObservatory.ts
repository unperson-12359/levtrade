import { useMemo } from 'react'
import { buildObservatorySnapshot } from '../observatory/engine'
import { useStore } from '../store'
import type { TrackedCoin } from '../types/market'

export function useIndicatorObservatory(coin: TrackedCoin) {
  const interval = useStore((state) => state.selectedInterval)
  const candles = useStore((state) => state.candles[coin])
  const fundingHistory = useStore((state) => state.fundingHistory[coin])
  const oiHistory = useStore((state) => state.oiHistory[coin])

  return useMemo(
    () =>
      buildObservatorySnapshot({
        coin,
        interval,
        candles,
        fundingHistory,
        oiHistory,
      }),
    [candles, coin, fundingHistory, interval, oiHistory],
  )
}

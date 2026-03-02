import { useMemo } from 'react'
import { useStore } from '../store'
import { computeSuggestedSetup } from '../signals/setup'
import { useSignals } from './useSignals'
import type { TrackedCoin } from '../types'

export function useSuggestedSetup(coin: TrackedCoin) {
  const { signals } = useSignals(coin)
  const currentPrice = useStore((s) => s.prices[coin])

  return useMemo(() => {
    if (!signals || signals.isWarmingUp || signals.isStale || !currentPrice) {
      return null
    }

    return computeSuggestedSetup(coin, signals, currentPrice)
  }, [coin, currentPrice, signals])
}

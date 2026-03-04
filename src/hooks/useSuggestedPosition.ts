import { useMemo } from 'react'
import { useStore } from '../store'
import type { TrackedCoin } from '../types/market'
import { computeSuggestedPositionComposition } from '../signals/suggestedPosition'
import { useSignals } from './useSignals'

export function useSuggestedPosition(coin?: TrackedCoin) {
  const selectedCoin = useStore((s) => s.selectedCoin)
  const accountSize = useStore((s) => s.riskInputs.accountSize)
  const currentPrice = useStore((s) => s.prices[coin ?? selectedCoin])
  const activeCoin = coin ?? selectedCoin
  const { signals } = useSignals(activeCoin)

  return useMemo(
    () =>
      computeSuggestedPositionComposition({
        coin: activeCoin,
        accountSize,
        currentPrice,
        signals,
      }),
    [accountSize, activeCoin, currentPrice, signals],
  )
}

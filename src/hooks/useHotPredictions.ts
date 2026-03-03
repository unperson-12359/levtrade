import { useStore } from '../store'
import type { TrackedSetup } from '../types/setup'

export type HeatTier = 'warm' | 'hot' | 'on-fire'

export interface HotPrediction {
  tracked: TrackedSetup
  currentPrice: number
  progressPct: number
  unrealizedPct: number
  heatTier: HeatTier
}

export function useHotPredictions(): HotPrediction[] {
  const trackedSetups = useStore((s) => s.trackedSetups)
  const prices = useStore((s) => s.prices)

  return trackedSetups
    .flatMap((tracked): HotPrediction[] => {
      const hasPending = Object.values(tracked.outcomes).some((o) => o.result === 'pending')
      if (!hasPending) return []

      const { coin, direction, entryPrice, targetPrice } = tracked.setup
      const currentPrice = prices[coin]
      if (!currentPrice || !isFinite(currentPrice) || currentPrice <= 0) return []

      const isLong = direction === 'long'
      const inProfit = isLong ? currentPrice > entryPrice : currentPrice < entryPrice
      if (!inProfit) return []

      const totalDistance = Math.abs(targetPrice - entryPrice)
      const currentDistance = Math.abs(currentPrice - entryPrice)
      const progressPct = totalDistance > 0 ? Math.min((currentDistance / totalDistance) * 100, 100) : 0

      const unrealizedPct = isLong
        ? ((currentPrice - entryPrice) / entryPrice) * 100
        : ((entryPrice - currentPrice) / entryPrice) * 100

      const heatTier: HeatTier = progressPct >= 50 ? 'on-fire' : progressPct >= 25 ? 'hot' : 'warm'

      return [{ tracked, currentPrice, progressPct, unrealizedPct, heatTier }]
    })
    .sort((a, b) => b.progressPct - a.progressPct)
}

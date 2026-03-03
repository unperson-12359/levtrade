import { useStore } from '../store'
import type { TrackedSetup } from '../types/setup'

export type HeatTier = 'warm' | 'hot' | 'on-fire'
export type SetupStatus = 'profit' | 'underwater'

export interface LiveSetup {
  tracked: TrackedSetup
  currentPrice: number
  /** 0-100 — toward target (profit) or toward stop (underwater) */
  progressPct: number
  /** Signed return % from entry to current price */
  unrealizedPct: number
  heatTier: HeatTier
  status: SetupStatus
}

export function useLiveSetups(): LiveSetup[] {
  const trackedSetups = useStore((s) => s.trackedSetups)
  const prices = useStore((s) => s.prices)

  return trackedSetups
    .flatMap((tracked): LiveSetup[] => {
      const hasPending = Object.values(tracked.outcomes).some((o) => o.result === 'pending')
      if (!hasPending) return []

      const { coin, direction, entryPrice, targetPrice, stopPrice } = tracked.setup
      const currentPrice = prices[coin]
      if (!currentPrice || !isFinite(currentPrice) || currentPrice <= 0) return []

      const isLong = direction === 'long'
      const inProfit = isLong ? currentPrice > entryPrice : currentPrice < entryPrice

      // Unrealized return %
      const unrealizedPct = isLong
        ? ((currentPrice - entryPrice) / entryPrice) * 100
        : ((entryPrice - currentPrice) / entryPrice) * 100

      if (inProfit) {
        // Progress toward target
        const totalDistance = Math.abs(targetPrice - entryPrice)
        const currentDistance = Math.abs(currentPrice - entryPrice)
        const progressPct = totalDistance > 0 ? Math.min((currentDistance / totalDistance) * 100, 100) : 0
        const heatTier: HeatTier = progressPct >= 50 ? 'on-fire' : progressPct >= 25 ? 'hot' : 'warm'

        return [{ tracked, currentPrice, progressPct, unrealizedPct, heatTier, status: 'profit' }]
      } else {
        // Progress toward stop
        const totalDistance = Math.abs(stopPrice - entryPrice)
        const currentDistance = Math.abs(currentPrice - entryPrice)
        const progressPct = totalDistance > 0 ? Math.min((currentDistance / totalDistance) * 100, 100) : 0

        return [{ tracked, currentPrice, progressPct, unrealizedPct, heatTier: 'warm', status: 'underwater' }]
      }
    })
    // Profitable first (highest progress), then underwater (closest to stop first)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'profit' ? -1 : 1
      if (a.status === 'profit') return b.progressPct - a.progressPct
      return b.progressPct - a.progressPct
    })
}

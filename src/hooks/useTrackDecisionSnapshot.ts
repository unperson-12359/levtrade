import { useEffect } from 'react'
import { useEntryDecision } from './useEntryDecision'
import { useStore } from '../store'

export function useTrackDecisionSnapshot() {
  const coin = useStore((s) => s.selectedCoin)
  const signals = useStore((s) => s.signals[coin])
  const price = useStore((s) => s.prices[coin])
  const trackDecisionSnapshot = useStore((s) => s.trackDecisionSnapshot)
  const decision = useEntryDecision(coin)

  useEffect(() => {
    if (!signals || signals.isStale || signals.isWarmingUp) {
      return
    }

    const referencePrice = price ?? 0
    if (!isFinite(referencePrice) || referencePrice <= 0) {
      return
    }

    trackDecisionSnapshot(
      coin,
      {
        action: decision.action,
        label: decision.label,
        reasons: decision.reasons,
        riskStatus: decision.riskStatus,
      },
      referencePrice,
      signals.updatedAt,
    )
  }, [
    coin,
    decision.action,
    decision.label,
    decision.reasons,
    decision.riskStatus,
    price,
    signals,
    trackDecisionSnapshot,
  ])
}

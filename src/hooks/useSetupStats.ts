import { useMemo } from 'react'
import { useStore } from '../store'
import type { ConfidenceTier, SetupPerformanceStats, SetupWindow, TierStats } from '../types/setup'

const CONFIDENCE_TIERS: ConfidenceTier[] = ['high', 'medium', 'low']
type TrackedSetupRecord = ReturnType<typeof useStore.getState>['trackedSetups'][number]
type PrimaryOutcome = TrackedSetupRecord['outcomes'][SetupWindow]

export function useSetupStats(window: SetupWindow = '24h'): SetupPerformanceStats {
  const trackedSetups = useStore((s) => s.trackedSetups)

  return useMemo(() => {
    const byTier = createTierRecord()
    const byCoin: Record<string, TierStats> = {}
    const byRegime: Record<string, TierStats> = {}
    const byEntryQuality: Record<string, TierStats> = {}
    const overall = emptyTierStats()

    trackedSetups.forEach((tracked) => {
      const outcome = tracked.outcomes[window]
      const { coin, confidenceTier, regime, entryQuality } = tracked.setup

      accumulate(byTier[confidenceTier], outcome)
      accumulate(overall, outcome)
      accumulate((byCoin[coin] ??= emptyTierStats()), outcome)
      accumulate((byRegime[regime] ??= emptyTierStats()), outcome)
      accumulate((byEntryQuality[entryQuality] ??= emptyTierStats()), outcome)
    })

    finalize(overall)
    CONFIDENCE_TIERS.forEach((tier) => finalize(byTier[tier]))
    Object.values(byCoin).forEach(finalize)
    Object.values(byRegime).forEach(finalize)
    Object.values(byEntryQuality).forEach(finalize)

    return {
      totalSetups: trackedSetups.length,
      byTier,
      byCoin,
      byRegime,
      byEntryQuality,
      overall,
    }
  }, [trackedSetups, window])
}

function createTierRecord(): Record<ConfidenceTier, TierStats> {
  return {
    high: emptyTierStats(),
    medium: emptyTierStats(),
    low: emptyTierStats(),
  }
}

function emptyTierStats(): TierStats {
  return {
    count: 0,
    wins: 0,
    losses: 0,
    expired: 0,
    unresolvable: 0,
    pending: 0,
    winRate: null,
    avgR: null,
    avgMfePct: null,
    avgMaePct: null,
    bestR: null,
    worstR: null,
  }
}

function accumulate(stats: TierStats, outcome: PrimaryOutcome) {
  stats.count += 1

  if (outcome.result === 'win') stats.wins += 1
  if (outcome.result === 'loss') stats.losses += 1
  if (outcome.result === 'expired') stats.expired += 1
  if (outcome.result === 'unresolvable') stats.unresolvable += 1
  if (outcome.result === 'pending') stats.pending += 1

  if (outcome.result === 'pending' || outcome.result === 'unresolvable') {
    return
  }

  if (outcome.rAchieved !== null) {
    stats.avgR = (stats.avgR ?? 0) + outcome.rAchieved
    stats.bestR = stats.bestR === null ? outcome.rAchieved : Math.max(stats.bestR, outcome.rAchieved)
    stats.worstR = stats.worstR === null ? outcome.rAchieved : Math.min(stats.worstR, outcome.rAchieved)
  }

  if (outcome.mfePct !== null) {
    stats.avgMfePct = (stats.avgMfePct ?? 0) + outcome.mfePct
  }

  if (outcome.maePct !== null) {
    stats.avgMaePct = (stats.avgMaePct ?? 0) + outcome.maePct
  }
}

function finalize(stats: TierStats) {
  const resolvedCount = stats.wins + stats.losses + stats.expired
  const directionalCount = stats.wins + stats.losses

  stats.winRate = directionalCount > 0 ? stats.wins / directionalCount : null
  stats.avgR = resolvedCount > 0 && stats.avgR !== null ? stats.avgR / resolvedCount : null
  stats.avgMfePct = resolvedCount > 0 && stats.avgMfePct !== null ? stats.avgMfePct / resolvedCount : null
  stats.avgMaePct = resolvedCount > 0 && stats.avgMaePct !== null ? stats.avgMaePct / resolvedCount : null
}

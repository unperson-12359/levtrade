import { useMemo } from 'react'
import { computeDecisionState } from '../signals'
import { usePositionRisk } from './usePositionRisk'
import { useStore } from '../store'
import type { DecisionAction, RiskStatus, SignalColor } from '../types/signals'
import type { TrackedCoin } from '../types/market'

export interface EntryDecisionState {
  action: DecisionAction
  label: string
  reasons: string[]
  color: SignalColor
  riskStatus: RiskStatus
}

export function useEntryDecision(coin: TrackedCoin): EntryDecisionState {
  const signals = useStore((s) => s.signals[coin])
  const { inputs, riskStatus } = usePositionRisk()

  return useMemo(() => {
    if (!signals) {
      return {
        action: 'wait',
        label: 'WAIT',
        reasons: ['loading data'],
        color: 'yellow',
        riskStatus: 'unknown',
      }
    }

    const activeRiskStatus = inputs.coin === coin ? riskStatus : 'unknown'
    const decision = computeDecisionState({
      composite: signals.composite,
      entryGeometry: signals.entryGeometry,
      hurst: signals.hurst,
      isStale: signals.isStale,
      isWarmingUp: signals.isWarmingUp,
      riskStatus: activeRiskStatus,
    })

    return {
      action: decision.action,
      label: decision.label,
      reasons: decision.reasons,
      color: decisionColor(decision.action),
      riskStatus: activeRiskStatus,
    }
  }, [coin, inputs.coin, riskStatus, signals])
}

/** Lightweight signal-only decision — no risk subscription, minimal store reads */
export function useSignalDecision(coin: TrackedCoin): EntryDecisionState {
  const signals = useStore((s) => s.signals[coin])

  return useMemo(() => {
    if (!signals) {
      return { action: 'wait' as const, label: 'WAIT', reasons: ['loading data'], color: 'yellow' as const, riskStatus: 'unknown' as const }
    }

    const decision = computeDecisionState({
      composite: signals.composite,
      entryGeometry: signals.entryGeometry,
      hurst: signals.hurst,
      isStale: signals.isStale,
      isWarmingUp: signals.isWarmingUp,
      riskStatus: 'unknown',
    })

    return {
      action: decision.action,
      label: decision.label,
      reasons: decision.reasons,
      color: decisionColor(decision.action),
      riskStatus: 'unknown' as const,
    }
  }, [signals])
}

function decisionColor(action: DecisionAction): SignalColor {
  switch (action) {
    case 'long':
    case 'short':
      return 'green'
    case 'wait':
      return 'yellow'
    case 'avoid':
      return 'red'
  }
}

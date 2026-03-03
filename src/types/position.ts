import type { TrackedCoin } from './market'
import type { RiskInputs, RiskOutputs, TradeDirection } from './risk'
import type { SignalColor } from './signals'
import type { SuggestedSetup } from './setup'

export interface SuggestedPositionComposition {
  hasSetup: boolean
  setup: SuggestedSetup | null
  accountSize: number
  mode: 'validated' | 'provisional' | 'none'
  inputs: RiskInputs
  outputs: RiskOutputs | null
  display: {
    marginUsd: number | null
    notionalUsd: number | null
    leverage: number | null
    accountHitAtStopPct: number | null
    liquidationDistancePct: number | null
    rrRatio: number | null
    tradeGrade: SignalColor | null
    tradeGradeLabel: string | null
    explanation: string
    modeLabel: string
    modeExplanation: string
    confidencePenalty: number | null
    capitalFraction: number | null
  }
  status: 'ready' | 'none' | 'invalid'
}

export interface PositionDisplayIdentity {
  coin: TrackedCoin | null
  direction: TradeDirection | null
  entryPrice: number | null
  stopPrice: number | null
  targetPrice: number | null
}

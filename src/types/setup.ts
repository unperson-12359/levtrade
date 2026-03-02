import type { TrackedCoin } from './market'
import type { EntryQuality, MarketRegime, SignalColor } from './signals'
import type { TradeDirection } from './risk'

export type ConfidenceTier = 'high' | 'medium' | 'low'
export type SetupWindow = '4h' | '24h' | '72h'
export type SetupOutcomeResult = 'win' | 'loss' | 'expired' | 'unresolvable' | 'pending'
export type SetupCoverageStatus = 'full' | 'partial' | 'insufficient'
export type SetupResolutionReason = 'target' | 'stop' | 'expired' | 'unresolvable' | 'pending'
export type SetupTimeframe = '4-12h' | '4-24h' | '24-72h' | 'wait'

export interface SuggestedSetup {
  coin: TrackedCoin
  direction: TradeDirection
  entryPrice: number
  stopPrice: number
  targetPrice: number
  meanReversionTarget: number
  rrRatio: number
  suggestedPositionSize: number
  suggestedLeverage: number
  tradeGrade: SignalColor
  confidence: number
  confidenceTier: ConfidenceTier
  entryQuality: EntryQuality
  agreementCount: number
  agreementTotal: number
  regime: MarketRegime
  reversionPotential: number
  stretchSigma: number
  atr: number
  compositeValue: number
  timeframe: SetupTimeframe
  summary: string
  generatedAt: number
  source?: 'live' | 'server' | 'backfill'
}

export interface TrackedSetup {
  id: string
  setup: SuggestedSetup
  coverageStatus?: SetupCoverageStatus
  outcomes: Record<SetupWindow, SetupOutcome>
}

export interface SetupOutcome {
  window: SetupWindow
  resolvedAt: number | null
  result: SetupOutcomeResult
  resolutionReason?: SetupResolutionReason
  coverageStatus?: SetupCoverageStatus
  candleCountUsed?: number
  returnPct: number | null
  rAchieved: number | null
  mfe: number | null
  mfePct: number | null
  mae: number | null
  maePct: number | null
  targetHit: boolean
  stopHit: boolean
  priceAtResolution: number | null
}

export interface SetupPerformanceStats {
  totalSetups: number
  byTier: Record<ConfidenceTier, TierStats>
  byCoin: Record<string, TierStats>
  byRegime: Record<string, TierStats>
  byEntryQuality: Record<string, TierStats>
  overall: TierStats
}

export interface TierStats {
  count: number
  wins: number
  losses: number
  expired: number
  unresolvable: number
  pending: number
  winRate: number | null
  avgR: number | null
  avgMfePct: number | null
  avgMaePct: number | null
  bestR: number | null
  worstR: number | null
}

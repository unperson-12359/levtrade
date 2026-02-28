import type { TrackedCoin } from './market'

export type SignalColor = 'green' | 'yellow' | 'red'

export type MarketRegime = 'trending' | 'mean-reverting' | 'choppy'

export interface HurstResult {
  value: number               // 0..1
  regime: MarketRegime
  color: SignalColor
  confidence: number          // 0..1, how much data we have vs minimum
  explanation: string
}

export interface ZScoreResult {
  value: number               // raw z-score
  normalizedSignal: number    // -1 to +1 normalized
  label: string               // "Strongly Oversold", "Neutral", etc.
  color: SignalColor
  explanation: string
}

export interface FundingResult {
  currentRate: number
  zScore: number
  normalizedSignal: number    // -1 to +1
  label: string
  color: SignalColor
  explanation: string
}

export interface OIDeltaResult {
  oiChangePct: number
  priceChangePct: number
  confirmation: boolean       // same direction = true
  normalizedSignal: number    // +1 or -1
  label: string
  color: SignalColor
  explanation: string
}

export interface VolatilityResult {
  realizedVol: number         // annualized %
  atr: number                 // absolute ATR value
  level: 'low' | 'normal' | 'high' | 'extreme'
  color: SignalColor
  explanation: string
}

export interface CompositeSignal {
  value: number               // -1 to +1
  direction: 'long' | 'short' | 'neutral'
  strength: 'strong' | 'moderate' | 'weak'
  agreementCount: number      // how many sub-signals agree
  agreementTotal: number      // total sub-signals counted
  color: SignalColor
  label: string
  explanation: string
  signalBreakdown: Array<{
    name: string
    direction: 'long' | 'short' | 'neutral'
    agrees: boolean
  }>
}

/** Full signal output per asset */
export interface AssetSignals {
  coin: TrackedCoin
  hurst: HurstResult
  zScore: ZScoreResult
  funding: FundingResult
  oiDelta: OIDeltaResult
  volatility: VolatilityResult
  composite: CompositeSignal
  updatedAt: number
  isStale: boolean            // data > 5 min old
  isWarmingUp: boolean        // insufficient candles
  warmupProgress: number      // 0..1
}

/** Overall status for the top bar */
export type OverallStatus = 'FAVORABLE' | 'CAUTION' | 'AVOID'

import type { SignalColor } from './signals'

export type MarketMomentCategory = 'session' | 'turn' | 'macro'

export type MarketMomentType =
  | 'us_cash_open'
  | 'us_cash_close'
  | 'london_open'
  | 'london_close'
  | 'tokyo_open'
  | 'tokyo_close'
  | 'month_open'
  | 'month_end'
  | 'quarter_open'
  | 'quarter_end'
  | 'cpi'
  | 'nfp'
  | 'fomc'
  | 'rate_decision'

export interface MacroMarketEvent {
  type: Extract<MarketMomentType, 'cpi' | 'nfp' | 'fomc' | 'rate_decision'>
  label: string
  timeUtc: string
  source: string
  importance: 'high' | 'medium'
  estimated?: boolean
}

export interface MarketMomentAggregate {
  type: MarketMomentType
  category: MarketMomentCategory
  label: string
  sampleCount: number
  avgAbsMovePct1h: number
  avgSignedMovePct1h: number
  avgFollowThroughPct4h: number
  latestEventTime: number | null
  latestMovePct1h: number | null
  impactScore: number
  tone: SignalColor
  summary: string
}

export interface UpcomingMarketMoment {
  type: MarketMomentType
  category: MarketMomentCategory
  label: string
  eventTime: number
  secondsUntil: number
  importance: 'high' | 'medium'
  note?: string
}

export interface MarketMomentSnapshot {
  generatedAt: number
  lookbackHours: number
  candleCount: number
  topMoments: MarketMomentAggregate[]
  nextMoments: UpcomingMarketMoment[]
}

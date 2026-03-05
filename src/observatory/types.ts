import type { TrackedCoin } from '../types/market'

export type IndicatorCategory =
  | 'Trend'
  | 'Momentum'
  | 'Volatility'
  | 'Volume'
  | 'Flow'
  | 'Structure'

export type IndicatorState = 'high' | 'low' | 'neutral'

export type QuantileBucket = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5'

export interface IndicatorSeriesPoint {
  time: number
  value: number
}

export interface IndicatorFrequency {
  stateCounts: Record<IndicatorState, number>
  stateTransitions: number
  stateTransitionRate: number
  activeRate: number
  quantileCounts: Record<QuantileBucket, number>
}

export interface IndicatorMetric {
  id: string
  label: string
  category: IndicatorCategory
  unit: string
  description: string
  currentValue: number | null
  currentState: IndicatorState
  quantileRank: number | null
  quantileBucket: QuantileBucket | null
  series: IndicatorSeriesPoint[]
  rawValues?: Array<number | null>
  frequency: IndicatorFrequency
}

export type IndicatorHealthStatus = 'healthy' | 'warning' | 'critical'

export interface IndicatorHealthWarning {
  indicatorId: string
  indicatorLabel: string
  kind: 'insufficient_data' | 'range_violation' | 'flatline'
  message: string
}

export interface IndicatorHealth {
  status: IndicatorHealthStatus
  total: number
  valid: number
  warnings: IndicatorHealthWarning[]
}

export interface CorrelationEdge {
  a: string
  b: string
  pearson: number
  spearman: number
  lagBars: number
  lagCorrelation: number
  sampleSize: number
  strength: number
}

export type IndicatorHitKind = 'enter_high' | 'enter_low' | 'exit_to_neutral' | 'flip'

export interface IndicatorHitEvent {
  id: string
  time: number
  indicatorId: string
  indicatorLabel: string
  category: IndicatorCategory
  kind: IndicatorHitKind
  fromState: IndicatorState
  toState: IndicatorState
  priority: number
  message: string
}

export interface CandleHitCluster {
  time: number
  totalHits: number
  topHits: IndicatorHitEvent[]
  overflowCount: number
  laneCounts: Partial<Record<IndicatorCategory, number>>
}

export interface ObservatorySnapshot {
  coin: TrackedCoin
  interval: '1h' | '4h' | '1d'
  generatedAt: number
  candleCount: number
  indicators: IndicatorMetric[]
  edges: CorrelationEdge[]
  timeline: CandleHitCluster[]
  health: IndicatorHealth
}

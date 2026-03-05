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

export interface ObservatorySnapshot {
  coin: TrackedCoin
  interval: '1h' | '4h' | '1d'
  generatedAt: number
  candleCount: number
  indicators: IndicatorMetric[]
  edges: CorrelationEdge[]
}

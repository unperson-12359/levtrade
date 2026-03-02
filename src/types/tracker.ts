import type { TrackedCoin } from './market'

export type TrackedSignalKind =
  | 'decision'
  | 'composite'
  | 'zScore'
  | 'funding'
  | 'oiDelta'
  | 'hurst'
  | 'entryGeometry'

export type TrackedDirection = 'long' | 'short' | 'neutral'
export type TrackerWindow = '4h' | '24h' | '72h'

export interface TrackedSignalRecord {
  id: string
  source: 'signal-engine' | 'risk-aware-ui'
  coin: TrackedCoin
  timestamp: number
  kind: TrackedSignalKind
  direction: TrackedDirection
  strength: number
  label: string
  referencePrice: number
  metadata: Record<string, string | number | boolean | null>
}

export interface TrackedSignalOutcome {
  recordId: string
  window: TrackerWindow
  resolvedAt: number | null
  futurePrice: number | null
  returnPct: number | null
  correct: boolean | null
}

export interface TrackerWindowMetric {
  sampleSize: number
  resolvedSize: number
  correctSize: number
  hitRate: number | null
  avgReturnPct: number | null
}

export interface TrackerKindStats {
  kind: TrackedSignalKind
  label: string
  windows: Record<TrackerWindow, TrackerWindowMetric>
  totalSignals: number
}

export interface TrackerStats {
  totalSignals: number
  totalResolved: number
  overallByWindow: Record<TrackerWindow, TrackerWindowMetric>
  byKind: TrackerKindStats[]
  bestKind24h: TrackerKindStats | null
  latestResolved: {
    kind: TrackedSignalKind
    label: string
    coin: TrackedCoin
    window: TrackerWindow
    correct: boolean
    returnPct: number | null
    resolvedAt: number
  } | null
}

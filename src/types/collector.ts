import type { TrackedCoin } from './market'

export type CollectorHealthStatus = 'live' | 'stale' | 'error' | 'unknown'

export interface CollectorCoinResult {
  coin: TrackedCoin
  ok: boolean
  error?: string
  setupGenerated: boolean
  setupId?: string
  outcomesResolved: number
}

export interface CollectorRunResult {
  processedAt: number
  results: CollectorCoinResult[]
}

export interface CollectorHeartbeat {
  collectorName: string
  lastRunAt: number | null
  lastSuccessAt: number | null
  lastError: string | null
  updatedAt: number | null
}

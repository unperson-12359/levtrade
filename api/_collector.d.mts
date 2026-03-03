// Type declarations for pre-bundled _collector.mjs (generated from src/server/collector/runCollector.ts)

export interface CollectorCoinResult {
  coin: string
  ok: boolean
  error?: string
  setupGenerated: boolean
  setupId?: string
  outcomesResolved: number
  signalsTracked: number
  signalsResolved: number
}

export interface CollectorRunResult {
  processedAt: number
  results: CollectorCoinResult[]
}

export function runCollector(): Promise<CollectorRunResult>

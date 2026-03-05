export const CONTRACT_VERSION_V1 = 'v1' as const

export type ContractVersionV1 = typeof CONTRACT_VERSION_V1

export type FreshnessStatusV1 = 'fresh' | 'delayed' | 'stale' | 'error'
export type DataSourceV1 = 'canonical' | 'fallback' | 'collector' | 'local' | 'derived'

export interface ContractMetaV1 {
  contractVersion: ContractVersionV1
  generatedAt: string
  freshness: FreshnessStatusV1
  source: DataSourceV1
  staleAfterMs: number
  lastSuccessfulAt: string | null
}

export interface BacktestWindowStatsV1 {
  sampleSize: number
  wins: number
  losses: number
  expired: number
  unresolvable: number
  pending: number
  winRate: number | null
  avgR: number | null
}

export interface BacktestResultV1 {
  strategyId: string
  windowDays: number
  generatedAt: string
  windows: {
    '4h': BacktestWindowStatsV1
    '24h': BacktestWindowStatsV1
    '72h': BacktestWindowStatsV1
  }
}

export interface LivePerformanceSnapshotV1 {
  portfolioId: string
  windowDays: number
  setupCount: number
  resolvedCount24h: number
  pendingCount24h: number
  winRate24h: number | null
  avgR24h: number | null
  latestSetupAt: string | null
  latestCollectorRunAt: string | null
  canonicalReady: boolean
  generatedAt: string
}

export type ExecutionEventTypeV1 =
  | 'collector.heartbeat'
  | 'canonical.setup-history'
  | 'canonical.signal-accuracy'
  | 'system.runtime'

export type ExecutionEventLevelV1 = 'info' | 'warn' | 'error'

export interface ExecutionEventV1 {
  contractVersion: ContractVersionV1
  id: string
  type: ExecutionEventTypeV1
  level: ExecutionEventLevelV1
  source: 'collector' | 'api' | 'browser'
  time: string
  summary: string
  details?: Record<string, unknown>
}

export function isFreshnessStatusV1(value: unknown): value is FreshnessStatusV1 {
  return value === 'fresh' || value === 'delayed' || value === 'stale' || value === 'error'
}

export function isContractMetaV1(value: unknown): value is ContractMetaV1 {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ContractMetaV1>
  return (
    candidate.contractVersion === CONTRACT_VERSION_V1 &&
    typeof candidate.generatedAt === 'string' &&
    isFreshnessStatusV1(candidate.freshness) &&
    typeof candidate.source === 'string' &&
    typeof candidate.staleAfterMs === 'number' &&
    (typeof candidate.lastSuccessfulAt === 'string' || candidate.lastSuccessfulAt === null)
  )
}

export function isExecutionEventV1(value: unknown): value is ExecutionEventV1 {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ExecutionEventV1>
  return (
    candidate.contractVersion === CONTRACT_VERSION_V1 &&
    typeof candidate.id === 'string' &&
    typeof candidate.type === 'string' &&
    (candidate.level === 'info' || candidate.level === 'warn' || candidate.level === 'error') &&
    (candidate.source === 'collector' || candidate.source === 'api' || candidate.source === 'browser') &&
    typeof candidate.time === 'string' &&
    typeof candidate.summary === 'string'
  )
}

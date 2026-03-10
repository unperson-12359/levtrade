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

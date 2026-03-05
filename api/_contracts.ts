import type { ContractMetaV1, DataSourceV1, FreshnessStatusV1 } from '../src/contracts/v1'

export const CONTRACT_VERSION_V1 = 'v1' as const

interface FreshnessConfig {
  nowMs?: number
  lastSuccessfulAtMs: number | null
  freshAfterMs?: number
  delayedAfterMs?: number
}

const DEFAULT_FRESH_AFTER_MS = 5 * 60 * 1000
const DEFAULT_DELAYED_AFTER_MS = 15 * 60 * 1000

export function computeFreshnessStatus(config: FreshnessConfig): FreshnessStatusV1 {
  const nowMs = config.nowMs ?? Date.now()
  const freshAfterMs = config.freshAfterMs ?? DEFAULT_FRESH_AFTER_MS
  const delayedAfterMs = config.delayedAfterMs ?? DEFAULT_DELAYED_AFTER_MS

  if (!Number.isFinite(config.lastSuccessfulAtMs)) {
    return 'error'
  }

  const ageMs = nowMs - (config.lastSuccessfulAtMs as number)
  if (ageMs <= freshAfterMs) return 'fresh'
  if (ageMs <= delayedAfterMs) return 'delayed'
  return 'stale'
}

export function buildContractMeta(params: {
  source: DataSourceV1
  lastSuccessfulAtMs: number | null
  freshness?: FreshnessStatusV1
  staleAfterMs?: number
  nowMs?: number
}): ContractMetaV1 {
  const nowMs = params.nowMs ?? Date.now()
  const staleAfterMs = params.staleAfterMs ?? DEFAULT_DELAYED_AFTER_MS
  return {
    contractVersion: CONTRACT_VERSION_V1,
    generatedAt: new Date(nowMs).toISOString(),
    freshness:
      params.freshness ??
      computeFreshnessStatus({
        nowMs,
        lastSuccessfulAtMs: params.lastSuccessfulAtMs,
        delayedAfterMs: staleAfterMs,
      }),
    source: params.source,
    staleAfterMs,
    lastSuccessfulAt: Number.isFinite(params.lastSuccessfulAtMs)
      ? new Date(params.lastSuccessfulAtMs as number).toISOString()
      : null,
  }
}

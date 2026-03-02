// Shared sync merge logic - used by both client (src/services/sync.ts) and
// server (api/sync.js via _sync-policy.mjs). Pure functions only - no DOM,
// no Node, no framework dependencies.

import { DEFAULT_RISK_INPUTS, type RiskInputs } from '../types/risk'
import type { TrackedSetup } from '../types/setup'
import type { RemoteAppStateV1 } from '../types/sync'
import type { TrackedSignalOutcome, TrackedSignalRecord } from '../types/tracker'

export function emptyRemoteState(): RemoteAppStateV1 {
  return {
    trackedSetups: [],
    trackedSignals: [],
    trackedOutcomes: [],
    trackerLastRunAt: null,
    riskInputs: { ...DEFAULT_RISK_INPUTS },
    riskInputsUpdatedAt: null,
    updatedAt: 0,
  }
}

export function normalizeRemoteState(value: unknown): RemoteAppStateV1 | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const v = value as Record<string, unknown>
  return {
    trackedSetups: Array.isArray(v.trackedSetups) ? (v.trackedSetups as TrackedSetup[]) : [],
    trackedSignals: Array.isArray(v.trackedSignals) ? (v.trackedSignals as TrackedSignalRecord[]) : [],
    trackedOutcomes: Array.isArray(v.trackedOutcomes) ? (v.trackedOutcomes as TrackedSignalOutcome[]) : [],
    trackerLastRunAt: typeof v.trackerLastRunAt === 'number' ? v.trackerLastRunAt : null,
    riskInputs: isRiskInputsShape(v.riskInputs) ? (v.riskInputs as RiskInputs) : { ...DEFAULT_RISK_INPUTS },
    riskInputsUpdatedAt: typeof v.riskInputsUpdatedAt === 'number' ? v.riskInputsUpdatedAt : null,
    updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : 0,
  }
}

export function mergeRemoteAndLocalState(
  local: RemoteAppStateV1,
  remote: RemoteAppStateV1 | null,
): RemoteAppStateV1 {
  if (!remote) {
    return local
  }

  const useRemoteRiskInputs =
    (remote.riskInputsUpdatedAt ?? 0) > (local.riskInputsUpdatedAt ?? 0) &&
    isRiskInputsShape(remote.riskInputs)

  return {
    trackedSetups: mergeTrackedSetups(local.trackedSetups, remote.trackedSetups),
    trackedSignals: mergeTrackedSignals(local.trackedSignals, remote.trackedSignals),
    trackedOutcomes: mergeTrackedOutcomes(local.trackedOutcomes, remote.trackedOutcomes),
    trackerLastRunAt: Math.max(local.trackerLastRunAt ?? 0, remote.trackerLastRunAt ?? 0) || null,
    riskInputs: useRemoteRiskInputs ? remote.riskInputs : local.riskInputs,
    riskInputsUpdatedAt: Math.max(local.riskInputsUpdatedAt ?? 0, remote.riskInputsUpdatedAt ?? 0) || null,
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  }
}

export function stableSerializeState(state: RemoteAppStateV1): string {
  return JSON.stringify({
    trackedSetups: [...state.trackedSetups].sort((a, b) => a.id.localeCompare(b.id)),
    trackedSignals: [...state.trackedSignals].sort((a, b) => a.id.localeCompare(b.id)),
    trackedOutcomes: [...state.trackedOutcomes].sort((a, b) =>
      `${a.recordId}:${a.window}`.localeCompare(`${b.recordId}:${b.window}`),
    ),
    trackerLastRunAt: state.trackerLastRunAt,
    riskInputs: state.riskInputs,
    riskInputsUpdatedAt: state.riskInputsUpdatedAt,
  })
}

export function isRiskInputsShape(value: unknown): value is RiskInputs {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Partial<RiskInputs>
  return (
    typeof candidate.coin === 'string' &&
    typeof candidate.direction === 'string' &&
    typeof candidate.entryPrice === 'number' &&
    typeof candidate.accountSize === 'number' &&
    typeof candidate.positionSize === 'number' &&
    typeof candidate.leverage === 'number'
  )
}

function mergeTrackedSetups(local: TrackedSetup[], remote: TrackedSetup[]): TrackedSetup[] {
  const merged = new Map<string, TrackedSetup>()

  for (const item of [...remote, ...local]) {
    const current = merged.get(item.id)
    if (!current) {
      merged.set(item.id, item)
      continue
    }
    merged.set(item.id, pickMoreCompleteSetup(current, item))
  }

  return [...merged.values()].sort((a, b) => a.setup.generatedAt - b.setup.generatedAt)
}

function pickMoreCompleteSetup(left: TrackedSetup, right: TrackedSetup): TrackedSetup {
  const leftScore = setupCompletenessScore(left)
  const rightScore = setupCompletenessScore(right)
  if (rightScore > leftScore) return right
  if (leftScore > rightScore) return left

  return latestResolvedAt(right) > latestResolvedAt(left) ? right : left
}

function setupCompletenessScore(setup: TrackedSetup): number {
  const outcomes = Object.values(setup.outcomes)
  const resolved = outcomes.filter((o) => o.result !== 'pending').length
  const metadata = outcomes.filter((o) => o.resolutionReason !== undefined || o.candleCountUsed !== undefined).length
  const coverage = setup.coverageStatus === 'full' ? 2 : setup.coverageStatus === 'partial' ? 1 : 0
  return resolved * 10 + metadata * 2 + coverage
}

function latestResolvedAt(setup: TrackedSetup): number {
  return Math.max(...Object.values(setup.outcomes).map((o) => o.resolvedAt ?? 0))
}

function mergeTrackedSignals(
  local: TrackedSignalRecord[],
  remote: TrackedSignalRecord[],
): TrackedSignalRecord[] {
  const merged = new Map<string, TrackedSignalRecord>()
  for (const record of [...remote, ...local]) {
    merged.set(record.id, record)
  }
  return [...merged.values()].sort((a, b) => a.timestamp - b.timestamp)
}

function mergeTrackedOutcomes(
  local: TrackedSignalOutcome[],
  remote: TrackedSignalOutcome[],
): TrackedSignalOutcome[] {
  const merged = new Map<string, TrackedSignalOutcome>()

  for (const outcome of [...remote, ...local]) {
    const key = `${outcome.recordId}:${outcome.window}`
    const current = merged.get(key)
    if (!current) {
      merged.set(key, outcome)
      continue
    }

    const currentResolved = current.resolvedAt !== null
    const incomingResolved = outcome.resolvedAt !== null
    if (!currentResolved && incomingResolved) {
      merged.set(key, outcome)
      continue
    }
    if (currentResolved && incomingResolved && (outcome.resolvedAt ?? 0) > (current.resolvedAt ?? 0)) {
      merged.set(key, outcome)
    }
  }

  return [...merged.values()].sort((a, b) =>
    `${a.recordId}:${a.window}`.localeCompare(`${b.recordId}:${b.window}`),
  )
}

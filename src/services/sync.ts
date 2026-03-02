import { DEFAULT_RISK_INPUTS, type RiskInputs } from '../types/risk'
import type { TrackedSetup } from '../types/setup'
import type { RemoteAppStateV1 } from '../types/sync'
import type { TrackedSignalOutcome, TrackedSignalRecord } from '../types/tracker'

const SYNC_ENDPOINT = '/api/sync'

interface SyncResponse {
  ok: boolean
  state: RemoteAppStateV1 | null
  updatedAt: string | null
  schemaVersion: number
  error?: string
}

interface PushResponse {
  ok: boolean
  acceptedState: RemoteAppStateV1
  updatedAt: string
  schemaVersion: number
  error?: string
}

export interface SyncStateInput {
  trackedSetups: TrackedSetup[]
  trackedSignals: TrackedSignalRecord[]
  trackedOutcomes: TrackedSignalOutcome[]
  trackerLastRunAt: number | null
  riskInputs: RiskInputs
  riskInputsUpdatedAt: number | null
}

export function buildRemoteAppState(input: SyncStateInput): RemoteAppStateV1 {
  return {
    trackedSetups: input.trackedSetups,
    trackedSignals: input.trackedSignals,
    trackedOutcomes: input.trackedOutcomes,
    trackerLastRunAt: input.trackerLastRunAt,
    riskInputs: input.riskInputs,
    riskInputsUpdatedAt: input.riskInputsUpdatedAt,
    updatedAt: Date.now(),
  }
}

export async function fetchRemoteState(secret: string): Promise<RemoteAppStateV1 | null> {
  const res = await fetch(SYNC_ENDPOINT, {
    method: 'GET',
    headers: {
      'x-levtrade-sync-secret': secret,
    },
  })

  const payload = (await res.json()) as SyncResponse
  if (!res.ok || !payload.ok) {
    throw new Error(payload.error ?? `Cloud sync failed with status ${res.status}`)
  }

  return normalizeRemoteState(payload.state)
}

export async function pushRemoteState(secret: string, state: RemoteAppStateV1): Promise<RemoteAppStateV1> {
  const res = await fetch(SYNC_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-levtrade-sync-secret': secret,
    },
    body: JSON.stringify({
      state,
      clientUpdatedAt: state.updatedAt,
    }),
  })

  const payload = (await res.json()) as PushResponse
  if (!res.ok || !payload.ok) {
    throw new Error(payload.error ?? `Cloud sync failed with status ${res.status}`)
  }

  return payload.acceptedState
}

export function mergeRemoteAndLocalState(
  local: RemoteAppStateV1,
  remote: RemoteAppStateV1 | null,
): RemoteAppStateV1 {
  if (!remote) {
    return local
  }

  const mergedSetups = mergeTrackedSetups(local.trackedSetups, remote.trackedSetups)
  const mergedSignals = mergeTrackedSignals(local.trackedSignals, remote.trackedSignals)
  const mergedOutcomes = mergeTrackedOutcomes(local.trackedOutcomes, remote.trackedOutcomes)

  const useRemoteRiskInputs =
    (remote.riskInputsUpdatedAt ?? 0) > (local.riskInputsUpdatedAt ?? 0) &&
    isRiskInputsShape(remote.riskInputs)

  return {
    trackedSetups: mergedSetups,
    trackedSignals: mergedSignals,
    trackedOutcomes: mergedOutcomes,
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

function normalizeRemoteState(value: unknown): RemoteAppStateV1 | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  return {
    trackedSetups: Array.isArray((value as { trackedSetups?: unknown[] }).trackedSetups)
      ? ((value as { trackedSetups: TrackedSetup[] }).trackedSetups)
      : [],
    trackedSignals: Array.isArray((value as { trackedSignals?: unknown[] }).trackedSignals)
      ? ((value as { trackedSignals: TrackedSignalRecord[] }).trackedSignals)
      : [],
    trackedOutcomes: Array.isArray((value as { trackedOutcomes?: unknown[] }).trackedOutcomes)
      ? ((value as { trackedOutcomes: TrackedSignalOutcome[] }).trackedOutcomes)
      : [],
    trackerLastRunAt:
      typeof (value as { trackerLastRunAt?: unknown }).trackerLastRunAt === 'number'
        ? ((value as { trackerLastRunAt: number }).trackerLastRunAt)
        : null,
    riskInputs: isRiskInputsShape((value as { riskInputs?: unknown }).riskInputs)
      ? ((value as { riskInputs: RiskInputs }).riskInputs)
      : { ...DEFAULT_RISK_INPUTS },
    riskInputsUpdatedAt:
      typeof (value as { riskInputsUpdatedAt?: unknown }).riskInputsUpdatedAt === 'number'
        ? ((value as { riskInputsUpdatedAt: number }).riskInputsUpdatedAt)
        : null,
    updatedAt: typeof (value as { updatedAt?: unknown }).updatedAt === 'number'
      ? ((value as { updatedAt: number }).updatedAt)
      : 0,
  }
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
  if (rightScore > leftScore) {
    return right
  }
  if (leftScore > rightScore) {
    return left
  }

  const leftResolvedAt = latestResolvedAt(left)
  const rightResolvedAt = latestResolvedAt(right)
  return rightResolvedAt > leftResolvedAt ? right : left
}

function setupCompletenessScore(setup: TrackedSetup): number {
  const outcomes = Object.values(setup.outcomes)
  const resolved = outcomes.filter((outcome) => outcome.result !== 'pending').length
  const metadata = outcomes.filter(
    (outcome) => outcome.resolutionReason !== undefined || outcome.candleCountUsed !== undefined,
  ).length
  const coverage = setup.coverageStatus === 'full' ? 2 : setup.coverageStatus === 'partial' ? 1 : 0
  return resolved * 10 + metadata * 2 + coverage
}

function latestResolvedAt(setup: TrackedSetup): number {
  return Math.max(...Object.values(setup.outcomes).map((outcome) => outcome.resolvedAt ?? 0))
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

function isRiskInputsShape(value: unknown): value is RiskInputs {
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

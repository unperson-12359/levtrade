import type { RiskInputs } from '../types/risk'
import type { TrackedSetup } from '../types/setup'
import type { RemoteAppStateV1 } from '../types/sync'
import type { TrackedSignalOutcome, TrackedSignalRecord } from '../types/tracker'
import {
  emptyRemoteState,
  mergeRemoteAndLocalState,
  normalizeRemoteState,
  stableSerializeState,
  isRiskInputsShape,
} from '../sync/policy'

// Re-export shared policy functions so existing importers still work
export {
  emptyRemoteState,
  isRiskInputsShape,
  mergeRemoteAndLocalState,
  normalizeRemoteState,
  stableSerializeState,
}

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

export async function fetchRemoteState(): Promise<RemoteAppStateV1 | null> {
  const res = await fetch(SYNC_ENDPOINT, {
    method: 'GET',
  })

  const payload = (await res.json()) as SyncResponse
  if (!res.ok || !payload.ok) {
    throw new Error(payload.error ?? `Cloud sync failed with status ${res.status}`)
  }

  return normalizeRemoteState(payload.state)
}

export async function pushRemoteState(state: RemoteAppStateV1): Promise<RemoteAppStateV1> {
  const res = await fetch(SYNC_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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

  const acceptedState = normalizeRemoteState(payload.acceptedState)
  if (!acceptedState) {
    throw new Error('Cloud sync returned an invalid state payload.')
  }

  return acceptedState
}

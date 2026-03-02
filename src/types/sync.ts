import type { RiskInputs } from './risk'
import type { TrackedSetup } from './setup'
import type { TrackedSignalOutcome, TrackedSignalRecord } from './tracker'

export interface RemoteAppStateV1 {
  trackedSetups: TrackedSetup[]
  trackedSignals: TrackedSignalRecord[]
  trackedOutcomes: TrackedSignalOutcome[]
  trackerLastRunAt: number | null
  riskInputs: RiskInputs
  riskInputsUpdatedAt: number | null
  updatedAt: number
}

export type SyncStatus = 'locked' | 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

import type { StateCreator } from 'zustand'
import type { AppStore } from '.'
import type { SyncStatus } from '../types/sync'

export interface SyncSlice {
  syncStatus: SyncStatus
  syncError: string | null
  lastCloudSyncAt: number | null
  riskInputsUpdatedAt: number | null

  setSyncStatus: (status: SyncStatus) => void
  setSyncError: (error: string | null) => void
  setLastCloudSyncAt: (timestamp: number | null) => void
}

export const createSyncSlice: StateCreator<AppStore, [], [], SyncSlice> = (set) => ({
  syncStatus: 'idle',
  syncError: null,
  lastCloudSyncAt: null,
  riskInputsUpdatedAt: null,

  setSyncStatus: (status) => set({ syncStatus: status }),
  setSyncError: (error) => set({ syncError: error }),
  setLastCloudSyncAt: (timestamp) => set({ lastCloudSyncAt: timestamp }),
})

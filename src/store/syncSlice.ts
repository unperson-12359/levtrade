import type { StateCreator } from 'zustand'
import type { AppStore } from '.'
import type { SyncStatus } from '../types/sync'

export interface SyncSlice {
  cloudSyncEnabled: boolean
  cloudSyncSecret: string
  syncStatus: SyncStatus
  syncError: string | null
  lastCloudSyncAt: number | null
  riskInputsUpdatedAt: number | null

  configureCloudSync: (secret: string) => void
  disableCloudSync: () => void
  setSyncStatus: (status: SyncStatus) => void
  setSyncError: (error: string | null) => void
  setLastCloudSyncAt: (timestamp: number | null) => void
}

export const createSyncSlice: StateCreator<AppStore, [], [], SyncSlice> = (set) => ({
  cloudSyncEnabled: false,
  cloudSyncSecret: '',
  syncStatus: 'locked',
  syncError: null,
  lastCloudSyncAt: null,
  riskInputsUpdatedAt: null,

  configureCloudSync: (secret) => {
    const trimmed = secret.trim()
    set({
      cloudSyncEnabled: trimmed.length > 0,
      cloudSyncSecret: trimmed,
      syncStatus: trimmed.length > 0 ? 'idle' : 'locked',
      syncError: null,
    })
  },

  disableCloudSync: () =>
    set({
      cloudSyncEnabled: false,
      cloudSyncSecret: '',
      syncStatus: 'locked',
      syncError: null,
    }),

  setSyncStatus: (status) => set({ syncStatus: status }),
  setSyncError: (error) => set({ syncError: error }),
  setLastCloudSyncAt: (timestamp) => set({ lastCloudSyncAt: timestamp }),
})

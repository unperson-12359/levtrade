import type { StateCreator } from 'zustand'
import type { AppStore } from '.'
import type { SyncStatus } from '../types/sync'
import { isValidSyncScope, normalizeSyncScope } from '../sync/policy'

export interface SyncSlice {
  cloudSyncEnabled: boolean
  cloudSyncScope: string
  cloudSyncSecret: string
  syncStatus: SyncStatus
  syncError: string | null
  lastCloudSyncAt: number | null
  riskInputsUpdatedAt: number | null

  configureCloudSync: (scope: string, secret: string) => void
  disableCloudSync: () => void
  setSyncStatus: (status: SyncStatus) => void
  setSyncError: (error: string | null) => void
  setLastCloudSyncAt: (timestamp: number | null) => void
}

export const createSyncSlice: StateCreator<AppStore, [], [], SyncSlice> = (set) => ({
  cloudSyncEnabled: false,
  cloudSyncScope: '',
  cloudSyncSecret: '',
  syncStatus: 'locked',
  syncError: null,
  lastCloudSyncAt: null,
  riskInputsUpdatedAt: null,

  configureCloudSync: (scope, secret) => {
    const normalizedScope = normalizeSyncScope(scope)
    const trimmed = secret.trim()
    const hasCredentials = normalizedScope.length > 0 && trimmed.length > 0
    const scopeIsValid = normalizedScope.length === 0 || isValidSyncScope(normalizedScope)
    set({
      cloudSyncEnabled: hasCredentials && scopeIsValid,
      cloudSyncScope: normalizedScope,
      cloudSyncSecret: trimmed,
      syncStatus: hasCredentials && scopeIsValid ? 'idle' : 'locked',
      syncError: !scopeIsValid
        ? 'Workspace id must be 3-64 characters and use lowercase letters, numbers, hyphens, or underscores.'
        : null,
    })
  },

  disableCloudSync: () =>
    set({
      cloudSyncEnabled: false,
      cloudSyncScope: '',
      cloudSyncSecret: '',
      syncStatus: 'locked',
      syncError: null,
    }),

  setSyncStatus: (status) => set({ syncStatus: status }),
  setSyncError: (error) => set({ syncError: error }),
  setLastCloudSyncAt: (timestamp) => set({ lastCloudSyncAt: timestamp }),
})

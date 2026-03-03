import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createMarketDataSlice, type MarketDataSlice } from './marketDataSlice'
import { createSetupSlice, type SetupSlice } from './setupSlice'
import { createSyncSlice, type SyncSlice } from './syncSlice'
import { createSignalsSlice, type SignalsSlice } from './signalsSlice'
import { createTrackerSlice, type TrackerSlice } from './trackerSlice'
import { createUISlice, type UISlice } from './uiSlice'
import { createContextSlice, type ContextSlice } from './contextSlice'

export type AppStore = MarketDataSlice & SignalsSlice & SetupSlice & SyncSlice & TrackerSlice & UISlice & ContextSlice

// Debounce localStorage writes so rapid set() calls during polling
// only serialize once (2s after the last mutation).
const debouncedStorage = {
  getItem: (name: string) => localStorage.getItem(name),
  setItem: (name: string, value: string) => {
    if (debouncedStorage._timer !== null) clearTimeout(debouncedStorage._timer)
    debouncedStorage._timer = setTimeout(() => {
      localStorage.setItem(name, value)
      debouncedStorage._timer = null
    }, 2000)
  },
  removeItem: (name: string) => localStorage.removeItem(name),
  _timer: null as ReturnType<typeof setTimeout> | null,
}

export const useStore = create<AppStore>()(
  persist(
    (...a) => ({
      ...createMarketDataSlice(...a),
      ...createSignalsSlice(...a),
      ...createSetupSlice(...a),
      ...createSyncSlice(...a),
      ...createTrackerSlice(...a),
      ...createUISlice(...a),
      ...createContextSlice(...a),
    }),
    {
      name: 'levtrade-storage',
      storage: createJSONStorage(() => debouncedStorage),
      partialize: (state) => ({
        expandedSections: state.expandedSections,
        selectedCoin: state.selectedCoin,
        selectedInterval: state.selectedInterval,
        riskInputs: state.riskInputs,
        riskInputsLocked: state.riskInputsLocked,
        trackedSignals: state.trackedSignals,
        trackedOutcomes: state.trackedOutcomes,
        trackerLastRunAt: state.trackerLastRunAt,
        trackedSetups: state.trackedSetups,
        lastCloudSyncAt: state.lastCloudSyncAt,
        riskInputsUpdatedAt: state.riskInputsUpdatedAt,
        analyticsTab: state.analyticsTab,
        lastSignalComputedAt: state.lastSignalComputedAt,
      }),
      merge: (persistedState, currentState) => {
        const merged = { ...currentState, ...(persistedState as Partial<AppStore>) }
        merged.syncStatus = 'idle'
        merged.syncError = null
        if (merged.riskInputs && merged.riskInputs.leverage > 40) {
          merged.riskInputs = { ...merged.riskInputs, leverage: 40 }
        }
        return merged as AppStore
      },
    },
  ),
)

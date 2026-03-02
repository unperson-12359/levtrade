import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createMarketDataSlice, type MarketDataSlice } from './marketDataSlice'
import { createSetupSlice, type SetupSlice } from './setupSlice'
import { createSyncSlice, type SyncSlice } from './syncSlice'
import { createSignalsSlice, type SignalsSlice } from './signalsSlice'
import { createTrackerSlice, type TrackerSlice } from './trackerSlice'
import { createUISlice, type UISlice } from './uiSlice'

export type AppStore = MarketDataSlice & SignalsSlice & SetupSlice & SyncSlice & TrackerSlice & UISlice

export const useStore = create<AppStore>()(
  persist(
    (...a) => ({
      ...createMarketDataSlice(...a),
      ...createSignalsSlice(...a),
      ...createSetupSlice(...a),
      ...createSyncSlice(...a),
      ...createTrackerSlice(...a),
      ...createUISlice(...a),
    }),
    {
      name: 'levtrade-storage',
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

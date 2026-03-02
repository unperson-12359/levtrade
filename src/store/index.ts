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
        riskInputs: state.riskInputs,
        trackedSignals: state.trackedSignals,
        trackedOutcomes: state.trackedOutcomes,
        trackerLastRunAt: state.trackerLastRunAt,
        trackedSetups: state.trackedSetups,
        cloudSyncEnabled: state.cloudSyncEnabled,
        cloudSyncSecret: state.cloudSyncSecret,
        lastCloudSyncAt: state.lastCloudSyncAt,
        riskInputsUpdatedAt: state.riskInputsUpdatedAt,
      }),
    },
  ),
)

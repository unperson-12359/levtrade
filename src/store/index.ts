import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createMarketDataSlice, type MarketDataSlice } from './marketDataSlice'
import { createSignalsSlice, type SignalsSlice } from './signalsSlice'
import { createTrackerSlice, type TrackerSlice } from './trackerSlice'
import { createUISlice, type UISlice } from './uiSlice'

export type AppStore = MarketDataSlice & SignalsSlice & TrackerSlice & UISlice

export const useStore = create<AppStore>()(
  persist(
    (...a) => ({
      ...createMarketDataSlice(...a),
      ...createSignalsSlice(...a),
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
      }),
    },
  ),
)

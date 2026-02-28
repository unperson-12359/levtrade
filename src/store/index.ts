import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createMarketDataSlice, type MarketDataSlice } from './marketDataSlice'
import { createSignalsSlice, type SignalsSlice } from './signalsSlice'
import { createUISlice, type UISlice } from './uiSlice'

export type AppStore = MarketDataSlice & SignalsSlice & UISlice

export const useStore = create<AppStore>()(
  persist(
    (...a) => ({
      ...createMarketDataSlice(...a),
      ...createSignalsSlice(...a),
      ...createUISlice(...a),
    }),
    {
      name: 'levtrade-storage',
      partialize: (state) => ({
        expandedSections: state.expandedSections,
        selectedCoin: state.selectedCoin,
        riskInputs: state.riskInputs,
      }),
    },
  ),
)

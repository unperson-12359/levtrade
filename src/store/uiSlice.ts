import type { StateCreator } from 'zustand'
import type { TrackedCoin } from '../types/market'
import type { RiskInputs } from '../types/risk'
import { DEFAULT_RISK_INPUTS } from '../types/risk'
import type { CandleInterval } from '../config/intervals'
import type { AppStore } from '.'

export type AnalyticsTab = 'accuracy' | 'history' | 'storage'

export interface UISlice {
  expandedSections: Record<string, boolean>
  selectedCoin: TrackedCoin
  selectedInterval: CandleInterval
  riskInputs: RiskInputs
  analyticsTab: AnalyticsTab

  toggleSection: (sectionId: string) => void
  selectCoin: (coin: TrackedCoin) => void
  setInterval: (interval: CandleInterval) => void
  updateRiskInput: <K extends keyof RiskInputs>(field: K, value: RiskInputs[K]) => void
  resetRiskInputs: () => void
  setAnalyticsTab: (tab: AnalyticsTab) => void
}

export const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set) => ({
  expandedSections: {},
  selectedCoin: 'BTC',
  selectedInterval: '1h',
  riskInputs: { ...DEFAULT_RISK_INPUTS },
  analyticsTab: 'accuracy',

  toggleSection: (sectionId) =>
    set((state) => ({
      expandedSections: {
        ...state.expandedSections,
        [sectionId]: !state.expandedSections[sectionId],
      },
    })),

  selectCoin: (coin) =>
    set((state) => ({
      selectedCoin: coin,
      riskInputs: {
        ...state.riskInputs,
        coin,
      },
      riskInputsUpdatedAt: Date.now(),
    })),

  updateRiskInput: (field, value) =>
    set((state) => ({
      riskInputs: { ...state.riskInputs, [field]: value },
      riskInputsUpdatedAt: Date.now(),
    })),

  setInterval: (interval) => set({ selectedInterval: interval }),

  setAnalyticsTab: (tab) => set({ analyticsTab: tab }),

  resetRiskInputs: () =>
    set((state) => ({
      riskInputs: {
        ...DEFAULT_RISK_INPUTS,
        coin: state.selectedCoin,
        entryPrice: state.prices[state.selectedCoin] ?? 0,
        accountSize: state.riskInputs.accountSize, // keep account size
      },
      riskInputsUpdatedAt: Date.now(),
    })),
})

import type { StateCreator } from 'zustand'
import type { TrackedCoin } from '../types/market'
import type { RiskInputs } from '../types/risk'
import { DEFAULT_RISK_INPUTS } from '../types/risk'
import type { AppStore } from '.'

export type AnalyticsTab = 'accuracy' | 'history' | 'storage'

export interface UISlice {
  expandedSections: Record<string, boolean>
  selectedCoin: TrackedCoin
  riskInputs: RiskInputs
  analyticsTab: AnalyticsTab

  toggleSection: (sectionId: string) => void
  selectCoin: (coin: TrackedCoin) => void
  updateRiskInput: <K extends keyof RiskInputs>(field: K, value: RiskInputs[K]) => void
  resetRiskInputs: () => void
  setAnalyticsTab: (tab: AnalyticsTab) => void
}

export const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set) => ({
  expandedSections: {},
  selectedCoin: 'BTC',
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
      // Update risk inputs coin + entry price
      riskInputs: {
        ...state.riskInputs,
        coin,
        entryPrice: state.prices[coin] ?? state.riskInputs.entryPrice,
      },
      riskInputsUpdatedAt: Date.now(),
    })),

  updateRiskInput: (field, value) =>
    set((state) => ({
      riskInputs: { ...state.riskInputs, [field]: value },
      riskInputsUpdatedAt: Date.now(),
    })),

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

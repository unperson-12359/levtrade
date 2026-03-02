import type { StateCreator } from 'zustand'
import type { TrackedCoin } from '../types/market'
import type { RiskInputs } from '../types/risk'
import { DEFAULT_RISK_INPUTS } from '../types/risk'
import type { AppStore } from '.'

export interface UISlice {
  expandedSections: Record<string, boolean>
  selectedCoin: TrackedCoin
  riskInputs: RiskInputs

  toggleSection: (sectionId: string) => void
  selectCoin: (coin: TrackedCoin) => void
  updateRiskInput: <K extends keyof RiskInputs>(field: K, value: RiskInputs[K]) => void
  resetRiskInputs: () => void
}

export const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set) => ({
  expandedSections: {},
  selectedCoin: 'BTC',
  riskInputs: { ...DEFAULT_RISK_INPUTS },

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

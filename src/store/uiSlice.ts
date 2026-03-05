import type { StateCreator } from 'zustand'
import type { TrackedCoin } from '../types/market'
import type { RiskInputs } from '../types/risk'
import { DEFAULT_RISK_INPUTS } from '../types/risk'
import type { CandleInterval } from '../config/intervals'
import type { AppStore } from '.'

export type AnalyticsTab = 'performance' | 'accuracy' | 'history' | 'storage'

export interface RuntimeDiagnostic {
  id: string
  time: number
  source: string
  message: string
  stack?: string | null
}

export interface UISlice {
  expandedSections: Record<string, boolean>
  selectedCoin: TrackedCoin
  selectedInterval: CandleInterval
  riskInputs: RiskInputs
  riskInputsLocked: boolean
  riskInputsUpdatedAt: number | null
  analyticsTab: AnalyticsTab
  runtimeDiagnostics: RuntimeDiagnostic[]

  toggleSection: (sectionId: string) => void
  selectCoin: (coin: TrackedCoin) => void
  setInterval: (interval: CandleInterval) => void
  updateRiskInput: <K extends keyof RiskInputs>(field: K, value: RiskInputs[K]) => void
  setRiskInputsLocked: (locked: boolean) => void
  resetRiskInputs: () => void
  setAnalyticsTab: (tab: AnalyticsTab) => void
  pushRuntimeDiagnostic: (diagnostic: {
    source: string
    message: string
    stack?: string | null
  }) => void
  clearRuntimeDiagnostics: () => void
}

export const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set) => ({
  expandedSections: {},
  selectedCoin: 'BTC',
  selectedInterval: '1h',
  riskInputs: { ...DEFAULT_RISK_INPUTS },
  riskInputsLocked: false,
  riskInputsUpdatedAt: null,
  analyticsTab: 'performance',
  runtimeDiagnostics: [],

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

  setRiskInputsLocked: (locked) => set({ riskInputsLocked: locked }),

  setInterval: (interval) => set({ selectedInterval: interval }),

  setAnalyticsTab: (tab) => set({ analyticsTab: tab }),

  pushRuntimeDiagnostic: (diagnostic) =>
    set((state) => {
      const now = Date.now()
      const normalizedMessage = diagnostic.message.trim().slice(0, 320)
      const normalizedSource = diagnostic.source.trim().slice(0, 64)
      const stack = diagnostic.stack?.trim().slice(0, 1800) ?? null

      const last = state.runtimeDiagnostics[state.runtimeDiagnostics.length - 1]
      if (
        last &&
        last.source === normalizedSource &&
        last.message === normalizedMessage &&
        now - last.time < 5_000
      ) {
        return state
      }

      const next: RuntimeDiagnostic = {
        id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
        time: now,
        source: normalizedSource,
        message: normalizedMessage || 'Unknown runtime issue',
        stack,
      }

      return {
        runtimeDiagnostics: [...state.runtimeDiagnostics.slice(-19), next],
      }
    }),

  clearRuntimeDiagnostics: () => set({ runtimeDiagnostics: [] }),

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

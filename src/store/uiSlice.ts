import type { StateCreator } from 'zustand'
import type { TrackedCoin } from '../types/market'
import type { ObservatoryCandleInterval } from '../config/intervals'
import type { AppStore } from '.'

export interface RuntimeDiagnostic {
  id: string
  time: number
  source: string
  message: string
  stack?: string | null
}

export interface UISlice {
  selectedCoin: TrackedCoin
  selectedInterval: ObservatoryCandleInterval
  observatoryGuideExpanded: boolean
  runtimeDiagnostics: RuntimeDiagnostic[]

  selectCoin: (coin: TrackedCoin) => void
  setInterval: (interval: ObservatoryCandleInterval) => void
  setObservatoryGuideExpanded: (expanded: boolean) => void
  toggleObservatoryGuideExpanded: () => void
  pushRuntimeDiagnostic: (diagnostic: {
    source: string
    message: string
    stack?: string | null
  }) => void
  clearRuntimeDiagnostics: () => void
}

export const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set) => ({
  selectedCoin: 'BTC',
  selectedInterval: '4h',
  observatoryGuideExpanded: false,
  runtimeDiagnostics: [],

  selectCoin: (coin) => set({ selectedCoin: coin }),

  setInterval: (interval) => set({ selectedInterval: interval }),

  setObservatoryGuideExpanded: (expanded) => set({ observatoryGuideExpanded: expanded }),

  toggleObservatoryGuideExpanded: () =>
    set((state) => ({ observatoryGuideExpanded: !state.observatoryGuideExpanded })),

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
})

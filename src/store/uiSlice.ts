import type { StateCreator } from 'zustand'
import type { TrackedCoin } from '../types/market'
import type { RiskInputs } from '../types/risk'
import { DEFAULT_RISK_INPUTS } from '../types/risk'
import type { CandleInterval } from '../config/intervals'
import type { AppStore } from '.'
import type { ExecutionEventV1, FreshnessStatusV1 } from '../contracts/v1'

export interface RuntimeDiagnostic {
  id: string
  time: number
  source: string
  message: string
  stack?: string | null
}

export type ExecutionStreamState = 'idle' | 'connected' | 'polling' | 'stale' | 'error'

export interface UISlice {
  expandedSections: Record<string, boolean>
  selectedCoin: TrackedCoin
  selectedInterval: CandleInterval
  riskInputs: RiskInputs
  riskInputsLocked: boolean
  riskInputsUpdatedAt: number | null
  runtimeDiagnostics: RuntimeDiagnostic[]
  canonicalFreshness: FreshnessStatusV1
  signalAccuracyFreshness: FreshnessStatusV1
  collectorFreshness: FreshnessStatusV1
  eventStreamStatus: ExecutionStreamState
  executionEvents: ExecutionEventV1[]

  toggleSection: (sectionId: string) => void
  selectCoin: (coin: TrackedCoin) => void
  setInterval: (interval: CandleInterval) => void
  updateRiskInput: <K extends keyof RiskInputs>(field: K, value: RiskInputs[K]) => void
  setRiskInputsLocked: (locked: boolean) => void
  resetRiskInputs: () => void
  pushRuntimeDiagnostic: (diagnostic: {
    source: string
    message: string
    stack?: string | null
  }) => void
  clearRuntimeDiagnostics: () => void
  setCanonicalFreshness: (status: FreshnessStatusV1) => void
  setSignalAccuracyFreshness: (status: FreshnessStatusV1) => void
  setCollectorFreshness: (status: FreshnessStatusV1) => void
  setEventStreamStatus: (status: ExecutionStreamState) => void
  ingestExecutionEvents: (events: ExecutionEventV1[]) => void
  clearExecutionEvents: () => void
}

export const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set) => ({
  expandedSections: {},
  selectedCoin: 'BTC',
  selectedInterval: '4h',
  riskInputs: { ...DEFAULT_RISK_INPUTS },
  riskInputsLocked: false,
  riskInputsUpdatedAt: null,
  runtimeDiagnostics: [],
  canonicalFreshness: 'stale',
  signalAccuracyFreshness: 'stale',
  collectorFreshness: 'stale',
  eventStreamStatus: 'idle',
  executionEvents: [],

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

  setCanonicalFreshness: (status) => set({ canonicalFreshness: status }),
  setSignalAccuracyFreshness: (status) => set({ signalAccuracyFreshness: status }),
  setCollectorFreshness: (status) => set({ collectorFreshness: status }),
  setEventStreamStatus: (status) => set({ eventStreamStatus: status }),

  ingestExecutionEvents: (events) =>
    set((state) => {
      if (events.length === 0) return state

      const existingById = new Map(state.executionEvents.map((event) => [event.id, event]))
      for (const event of events) {
        existingById.set(event.id, event)
      }
      const merged = [...existingById.values()]
        .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))
        .slice(-80)

      return { executionEvents: merged }
    }),

  clearExecutionEvents: () => set({ executionEvents: [] }),

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

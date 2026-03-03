import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createMarketDataSlice, type MarketDataSlice } from './marketDataSlice'
import { createSetupSlice, type SetupSlice } from './setupSlice'
import { createSignalsSlice, type SignalsSlice } from './signalsSlice'
import { createTrackerSlice, type TrackerSlice } from './trackerSlice'
import { createUISlice, type UISlice } from './uiSlice'
import { createContextSlice, type ContextSlice } from './contextSlice'

export type AppStore = MarketDataSlice & SignalsSlice & SetupSlice & TrackerSlice & UISlice & ContextSlice

// Throttle-with-trailing localStorage writes.
// Trailing debounce (2s) coalesces rapid set() bursts.
// Max-wait ceiling (10s) prevents WebSocket tick starvation.
// beforeunload flush guarantees persist on tab close.
const DEBOUNCE_MS = 2_000
const MAX_WAIT_MS = 10_000

const throttledStorage = {
  getItem: (name: string) => localStorage.getItem(name),
  setItem: (name: string, value: string) => {
    throttledStorage._pendingName = name
    throttledStorage._pendingValue = value

    // Reset trailing debounce
    if (throttledStorage._timer !== null) clearTimeout(throttledStorage._timer)
    throttledStorage._timer = setTimeout(flushStorage, DEBOUNCE_MS)

    // Set max-wait ceiling (only if not already running)
    if (throttledStorage._maxWaitTimer === null) {
      throttledStorage._maxWaitTimer = setTimeout(flushStorage, MAX_WAIT_MS)
    }
  },
  removeItem: (name: string) => localStorage.removeItem(name),
  _timer: null as ReturnType<typeof setTimeout> | null,
  _maxWaitTimer: null as ReturnType<typeof setTimeout> | null,
  _pendingName: null as string | null,
  _pendingValue: null as string | null,
}

function flushStorage() {
  if (throttledStorage._pendingName !== null && throttledStorage._pendingValue !== null) {
    localStorage.setItem(throttledStorage._pendingName, throttledStorage._pendingValue)
    throttledStorage._pendingName = null
    throttledStorage._pendingValue = null
  }
  if (throttledStorage._timer !== null) {
    clearTimeout(throttledStorage._timer)
    throttledStorage._timer = null
  }
  if (throttledStorage._maxWaitTimer !== null) {
    clearTimeout(throttledStorage._maxWaitTimer)
    throttledStorage._maxWaitTimer = null
  }
}

// Flush pending writes on tab close to prevent data loss
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushStorage)
}

export const useStore = create<AppStore>()(
  persist(
    (...a) => ({
      ...createMarketDataSlice(...a),
      ...createSignalsSlice(...a),
      ...createSetupSlice(...a),
      ...createTrackerSlice(...a),
      ...createUISlice(...a),
      ...createContextSlice(...a),
    }),
    {
      name: 'levtrade-storage',
      storage: createJSONStorage(() => throttledStorage),
      partialize: (state) => ({
        expandedSections: state.expandedSections,
        selectedCoin: state.selectedCoin,
        selectedInterval: state.selectedInterval,
        riskInputs: state.riskInputs,
        riskInputsLocked: state.riskInputsLocked,
        trackedSignals: state.trackedSignals,
        trackedOutcomes: state.trackedOutcomes,
        trackerLastRunAt: state.trackerLastRunAt,
        localTrackedSetups: state.localTrackedSetups,
        riskInputsUpdatedAt: state.riskInputsUpdatedAt,
        analyticsTab: state.analyticsTab,
        lastSignalComputedAt: state.lastSignalComputedAt,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AppStore> & { trackedSetups?: unknown[] }
        const merged = { ...currentState, ...persisted }
        if (merged.riskInputs && merged.riskInputs.leverage > 40) {
          merged.riskInputs = { ...merged.riskInputs, leverage: 40 }
        }
        // Close overlay panels on refresh so dashboard is always the landing
        if (merged.expandedSections) {
          merged.expandedSections = { ...merged.expandedSections }
          delete merged.expandedSections['analytics']
          delete merged.expandedSections['how-it-works']
        }
        // Migrate legacy trackedSetups → localTrackedSetups
        if (persisted.trackedSetups && Array.isArray(persisted.trackedSetups) && persisted.trackedSetups.length > 0) {
          merged.localTrackedSetups = persisted.trackedSetups as AppStore['localTrackedSetups']
        }
        // Server setups are never persisted — always start empty, hydrated from server
        merged.serverTrackedSetups = []
        return merged as AppStore
      },
    },
  ),
)

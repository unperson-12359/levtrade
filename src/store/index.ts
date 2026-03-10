import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createMarketDataSlice, type MarketDataSlice } from './marketDataSlice'
import { createUISlice, type UISlice } from './uiSlice'

export type AppStore = MarketDataSlice & UISlice

const DEBOUNCE_MS = 2_000
const MAX_WAIT_MS = 10_000

const throttledStorage = {
  getItem: (name: string) => localStorage.getItem(name),
  setItem: (name: string, value: string) => {
    throttledStorage._pendingName = name
    throttledStorage._pendingValue = value

    if (throttledStorage._timer !== null) clearTimeout(throttledStorage._timer)
    throttledStorage._timer = setTimeout(flushStorage, DEBOUNCE_MS)

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

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushStorage)
}

export const useStore = create<AppStore>()(
  persist(
    (...a) => ({
      ...createMarketDataSlice(...a),
      ...createUISlice(...a),
    }),
    {
      name: 'levtrade-storage',
      storage: createJSONStorage(() => throttledStorage),
      partialize: (state) => ({
        selectedCoin: state.selectedCoin,
        selectedInterval: state.selectedInterval,
        observatoryGuideExpanded: state.observatoryGuideExpanded,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AppStore>
        const merged = { ...currentState, ...persisted }

        if (merged.selectedInterval !== '4h' && merged.selectedInterval !== '1d') {
          merged.selectedInterval = '4h'
        }
        if (typeof merged.observatoryGuideExpanded !== 'boolean') {
          merged.observatoryGuideExpanded = false
        }

        merged.runtimeDiagnostics = []
        return merged as AppStore
      },
    },
  ),
)

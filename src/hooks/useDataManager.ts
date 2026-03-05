import { useEffect, useRef } from 'react'
import { DataManager } from '../services/dataManager'
import { useStore } from '../store'
import { TRACKED_COINS } from '../types/market'

export function useDataManager() {
  const managerRef = useRef<DataManager | null>(null)
  const interval = useStore((s) => s.selectedInterval)
  const selectedCoin = useStore((s) => s.selectedCoin)
  const enabled = import.meta.env.VITE_E2E_MOCK !== '1'

  useEffect(() => {
    if (!enabled) return

    // Prevent double initialization in StrictMode
    if (managerRef.current) return

    const manager = new DataManager(useStore)
    managerRef.current = manager

    manager.initialize().catch(() => {
      // Errors already handled inside DataManager
    })

    return () => {
      manager.destroy()
      managerRef.current = null
    }
  }, [enabled])

  // Refetch candles when timeframe changes
  const prevInterval = useRef(interval)
  useEffect(() => {
    if (!enabled) return
    if (interval === prevInterval.current) return
    prevInterval.current = interval
    const manager = managerRef.current
    if (!manager) return

    manager.fetchAllCandles([selectedCoin]).then(() => {
      useStore.getState().computeAllSignals()
      useStore.getState().trackAllDecisionSnapshots()
      useStore.getState().resolveSetupOutcomes()
      useStore.getState().resolveTrackedOutcomes()
      useStore.getState().pruneTrackerHistory()

      const remainingCoins = TRACKED_COINS.filter((coin) => coin !== selectedCoin)
      if (remainingCoins.length > 0) {
        void manager.fetchAllCandles(remainingCoins).then(() => {
          useStore.getState().computeAllSignals()
          useStore.getState().trackAllDecisionSnapshots()
          useStore.getState().resolveSetupOutcomes()
          useStore.getState().resolveTrackedOutcomes()
          useStore.getState().pruneTrackerHistory()
        }).catch(() => {
          // Errors handled inside DataManager
        })
      }
    }).catch(() => {
      // Errors handled inside DataManager
    })
  }, [enabled, interval, selectedCoin])
}

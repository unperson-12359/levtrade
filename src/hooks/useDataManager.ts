import { useEffect, useRef } from 'react'
import { DataManager } from '../services/dataManager'
import { useStore } from '../store'
import { TRACKED_COINS } from '../types/market'

export function useDataManager() {
  const managerRef = useRef<DataManager | null>(null)
  const interval = useStore((state) => state.selectedInterval)
  const selectedCoin = useStore((state) => state.selectedCoin)
  const enabled = import.meta.env.VITE_E2E_MOCK !== '1'

  useEffect(() => {
    if (!enabled || managerRef.current) return

    const manager = new DataManager(useStore)
    managerRef.current = manager

    manager.initialize().catch(() => {
      // Errors are already captured by DataManager diagnostics.
    })

    return () => {
      manager.destroy()
      managerRef.current = null
    }
  }, [enabled])

  const previousContext = useRef({ interval, selectedCoin })
  useEffect(() => {
    if (!enabled) return
    const manager = managerRef.current
    if (!manager) return

    const previous = previousContext.current
    const intervalChanged = interval !== previous.interval
    const coinChanged = selectedCoin !== previous.selectedCoin
    if (!intervalChanged && !coinChanged) return
    previousContext.current = { interval, selectedCoin }

    if (intervalChanged) {
      manager.fetchAllCandles([selectedCoin], 'smart')
        .then(() => {
          const remainingCoins = TRACKED_COINS.filter((coin) => coin !== selectedCoin)
          if (remainingCoins.length > 0) {
            return manager.fetchAllCandles(remainingCoins, 'smart')
          }
        })
        .catch(() => {
          // Errors are already captured by DataManager diagnostics.
        })
      return
    }

    void manager.fetchAllCandles([selectedCoin], 'smart').catch(() => {
      // Errors are already captured by DataManager diagnostics.
    })
  }, [enabled, interval, selectedCoin])
}

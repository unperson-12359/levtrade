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

  const previousInterval = useRef(interval)
  useEffect(() => {
    if (!enabled || interval === previousInterval.current) return
    previousInterval.current = interval

    const manager = managerRef.current
    if (!manager) return

    manager.fetchAllCandles([selectedCoin], 'full')
      .then(() => {
        const remainingCoins = TRACKED_COINS.filter((coin) => coin !== selectedCoin)
        if (remainingCoins.length > 0) {
          return manager.fetchAllCandles(remainingCoins, 'full')
        }
      })
      .catch(() => {
        // Errors are already captured by DataManager diagnostics.
      })
  }, [enabled, interval, selectedCoin])

  const previousSelectedCoin = useRef(selectedCoin)
  useEffect(() => {
    if (!enabled || selectedCoin === previousSelectedCoin.current) return
    previousSelectedCoin.current = selectedCoin

    const manager = managerRef.current
    if (!manager) return

    void manager.fetchAllCandles([selectedCoin], 'full').catch(() => {
      // Errors are already captured by DataManager diagnostics.
    })
  }, [enabled, selectedCoin])
}

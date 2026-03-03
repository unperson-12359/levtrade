import { useEffect, useRef } from 'react'
import { DataManager } from '../services/dataManager'
import { useStore } from '../store'

export function useDataManager() {
  const managerRef = useRef<DataManager | null>(null)
  const interval = useStore((s) => s.selectedInterval)

  useEffect(() => {
    // Prevent double initialization in StrictMode
    if (managerRef.current) return

    const manager = new DataManager(useStore)
    managerRef.current = manager

    manager.initialize().then(() => {
      useStore.getState().computeAllSignals()
      useStore.getState().trackAllDecisionSnapshots()
      useStore.getState().resolveSetupOutcomes()
      useStore.getState().resolveTrackedOutcomes()
      useStore.getState().pruneSetupHistory()
      useStore.getState().pruneTrackerHistory()
    }).catch(() => {
      // Errors already handled inside DataManager
    })

    return () => {
      manager.destroy()
      managerRef.current = null
    }
  }, [])

  // Refetch candles when timeframe changes
  const prevInterval = useRef(interval)
  useEffect(() => {
    if (interval === prevInterval.current) return
    prevInterval.current = interval
    const manager = managerRef.current
    if (!manager) return

    manager.fetchAllCandles().then(() => {
      useStore.getState().computeAllSignals()
      useStore.getState().trackAllDecisionSnapshots()
      useStore.getState().resolveSetupOutcomes()
      useStore.getState().resolveTrackedOutcomes()
      useStore.getState().pruneTrackerHistory()
    }).catch(() => {
      // Errors handled inside DataManager
    })
  }, [interval])
}

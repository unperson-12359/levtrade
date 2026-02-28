import { useEffect, useRef } from 'react'
import { DataManager } from '../services/dataManager'
import { useStore } from '../store'

export function useDataManager() {
  const managerRef = useRef<DataManager | null>(null)

  useEffect(() => {
    // Prevent double initialization in StrictMode
    if (managerRef.current) return

    const manager = new DataManager(useStore)
    managerRef.current = manager

    manager.initialize().then(() => {
      useStore.getState().computeAllSignals()
    }).catch(() => {
      // Errors already handled inside DataManager
    })

    return () => {
      manager.destroy()
      managerRef.current = null
    }
  }, [])
}

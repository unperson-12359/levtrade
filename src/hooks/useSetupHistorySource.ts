import { useMemo } from 'react'
import { useStore } from '../store'
import type { TrackedSetup } from '../types/setup'

export type SetupHistorySource = 'server' | 'local-fallback'

export function useSetupHistorySource(): {
  trackedSetups: TrackedSetup[]
  source: SetupHistorySource
  usingFallback: boolean
} {
  const serverTrackedSetups = useStore((s) => s.serverTrackedSetups)
  const localTrackedSetups = useStore((s) => s.localTrackedSetups)

  return useMemo(() => {
    const hasServer = serverTrackedSetups.length > 0
    const hasLocal = localTrackedSetups.length > 0

    if (hasServer) {
      return { trackedSetups: serverTrackedSetups, source: 'server' as const, usingFallback: false }
    }

    if (hasLocal) {
      return { trackedSetups: localTrackedSetups, source: 'local-fallback' as const, usingFallback: true }
    }

    return { trackedSetups: [], source: 'server' as const, usingFallback: false }
  }, [localTrackedSetups, serverTrackedSetups])
}

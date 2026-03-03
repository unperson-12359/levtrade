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
    if (serverTrackedSetups.length > 0 || localTrackedSetups.length === 0) {
      return {
        trackedSetups: serverTrackedSetups,
        source: 'server' as const,
        usingFallback: false,
      }
    }

    return {
      trackedSetups: localTrackedSetups,
      source: 'local-fallback' as const,
      usingFallback: true,
    }
  }, [localTrackedSetups, serverTrackedSetups])
}

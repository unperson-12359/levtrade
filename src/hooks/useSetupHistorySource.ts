import { useMemo } from 'react'
import { useStore } from '../store'
import { buildSetupId } from '../utils/identity'
import type { TrackedSetup } from '../types/setup'

export type SetupHistorySource = 'server' | 'merged' | 'local-fallback'

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

    if (!hasServer && !hasLocal) {
      return { trackedSetups: [], source: 'server' as const, usingFallback: false }
    }

    if (!hasLocal) {
      return { trackedSetups: serverTrackedSetups, source: 'server' as const, usingFallback: false }
    }

    // Merge: server canonical + unique local setups (deduped by id and semantic key)
    const serverIds = new Set(serverTrackedSetups.map((s) => s.id))
    const serverKeys = new Set(serverTrackedSetups.map((s) => buildSetupId(s.setup)))
    const uniqueLocal = localTrackedSetups.filter(
      (l) => !serverIds.has(l.id) && !serverKeys.has(buildSetupId(l.setup)),
    )

    const merged = [...serverTrackedSetups, ...uniqueLocal].sort(
      (a, b) => a.setup.generatedAt - b.setup.generatedAt,
    )

    return {
      trackedSetups: merged,
      source: hasServer ? 'merged' as const : 'local-fallback' as const,
      usingFallback: !hasServer,
    }
  }, [localTrackedSetups, serverTrackedSetups])
}

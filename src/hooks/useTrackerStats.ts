import { useMemo } from 'react'
import { useStore } from '../store'
import { computeTrackerStats } from '../signals/trackerStats'
import type { TrackerStats } from '../types/tracker'

export function useTrackerStats(): TrackerStats {
  const trackedSignals = useStore((s) => s.trackedSignals)
  const trackedOutcomes = useStore((s) => s.trackedOutcomes)

  return useMemo(
    () => computeTrackerStats(trackedSignals, trackedOutcomes),
    [trackedSignals, trackedOutcomes],
  )
}

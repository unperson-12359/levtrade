import { useMemo } from 'react'
import { useStore } from '../store'
import type {
  TrackerKindStats,
  TrackerStats,
  TrackerWindow,
  TrackerWindowMetric,
  TrackedSignalKind,
} from '../types/tracker'

const SIGNAL_KIND_LABELS: Record<TrackedSignalKind, string> = {
  decision: 'Decision',
  composite: 'Composite',
  zScore: 'Z-Score',
  funding: 'Funding',
  oiDelta: 'OI Delta',
  hurst: 'Regime',
  entryGeometry: 'Entry Geometry',
}

const WINDOWS: TrackerWindow[] = ['4h', '24h', '72h']

export function useTrackerStats(): TrackerStats {
  const trackedSignals = useStore((s) => s.trackedSignals)
  const trackedOutcomes = useStore((s) => s.trackedOutcomes)

  return useMemo(() => {
    const byKind = Object.keys(SIGNAL_KIND_LABELS).map((kind) => {
      const typedKind = kind as TrackedSignalKind
      const records = trackedSignals.filter((record) => record.kind === typedKind)

      return {
        kind: typedKind,
        label: SIGNAL_KIND_LABELS[typedKind],
        totalSignals: records.length,
        windows: buildWindowMetrics(records.map((record) => record.id), trackedOutcomes),
      } satisfies TrackerKindStats
    })

    const totalSignals = trackedSignals.length
    const totalResolved = trackedOutcomes.filter((outcome) => outcome.resolvedAt !== null).length
    const overallByWindow = buildWindowMetrics(trackedSignals.map((record) => record.id), trackedOutcomes)

    const bestKind24h = [...byKind]
      .filter((item) => item.windows['24h'].sampleSize > 0 && item.windows['24h'].hitRate !== null)
      .sort((a, b) => {
        const delta = (b.windows['24h'].hitRate ?? -1) - (a.windows['24h'].hitRate ?? -1)
        if (delta !== 0) return delta
        return b.windows['24h'].sampleSize - a.windows['24h'].sampleSize
      })[0] ?? null

    const latestResolved = [...trackedOutcomes]
      .filter((outcome) => outcome.resolvedAt !== null && outcome.correct !== null)
      .sort((a, b) => (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0))[0]

    return {
      totalSignals,
      totalResolved,
      overallByWindow,
      byKind,
      bestKind24h,
      latestResolved: latestResolved
        ? buildLatestResolved(latestResolved.recordId, latestResolved.window, latestResolved.correct!, latestResolved.returnPct, latestResolved.resolvedAt!, trackedSignals)
        : null,
    }
  }, [trackedOutcomes, trackedSignals])
}

function buildWindowMetrics(recordIds: string[], outcomes: ReturnType<typeof useStore.getState>['trackedOutcomes']): Record<TrackerWindow, TrackerWindowMetric> {
  const idSet = new Set(recordIds)

  return WINDOWS.reduce((acc, window) => {
    const windowOutcomes = outcomes.filter((outcome) => outcome.window === window && idSet.has(outcome.recordId))
    const scored = windowOutcomes.filter((outcome) => outcome.correct !== null)
    const correctSize = scored.filter((outcome) => outcome.correct === true).length
    const returns = scored.map((outcome) => outcome.returnPct).filter((value): value is number => value !== null)

    acc[window] = {
      sampleSize: scored.length,
      resolvedSize: windowOutcomes.filter((outcome) => outcome.resolvedAt !== null).length,
      correctSize,
      hitRate: scored.length > 0 ? correctSize / scored.length : null,
      avgReturnPct: returns.length > 0 ? returns.reduce((sum, value) => sum + value, 0) / returns.length : null,
    }

    return acc
  }, {} as Record<TrackerWindow, TrackerWindowMetric>)
}

function buildLatestResolved(
  recordId: string,
  window: TrackerWindow,
  correct: boolean,
  returnPct: number | null,
  resolvedAt: number,
  records: ReturnType<typeof useStore.getState>['trackedSignals'],
): TrackerStats['latestResolved'] {
  const record = records.find((item) => item.id === recordId)
  if (!record) {
    return null
  }

  return {
    kind: record.kind,
    label: SIGNAL_KIND_LABELS[record.kind],
    coin: record.coin,
    window,
    correct,
    returnPct,
    resolvedAt,
  }
}

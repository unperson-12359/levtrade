import { useState, useEffect, useCallback } from 'react'
import { fetchSignalAccuracy } from '../services/api'
import type { TrackerStats } from '../types/tracker'

const REFRESH_INTERVAL_MS = 5 * 60 * 1000

const EMPTY_WINDOW = { sampleSize: 0, resolvedSize: 0, correctSize: 0, hitRate: null, avgReturnPct: null }

const EMPTY_STATS: TrackerStats = {
  totalSignals: 0,
  totalResolved: 0,
  overallByWindow: {
    '4h': { ...EMPTY_WINDOW },
    '24h': { ...EMPTY_WINDOW },
    '72h': { ...EMPTY_WINDOW },
  },
  byKind: [],
  bestKind24h: null,
  latestResolved: null,
}

export function useServerTrackerStats(): {
  stats: TrackerStats
  loading: boolean
  error: string | null
  truncated: boolean
  recordCount: number
  windowDays: number
  computedAt: string | null
} {
  const [stats, setStats] = useState<TrackerStats>(EMPTY_STATS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [recordCount, setRecordCount] = useState(0)
  const [windowDays, setWindowDays] = useState(90)
  const [computedAt, setComputedAt] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const result = await fetchSignalAccuracy()
    if (result.stats) {
      setStats(result.stats)
      setError(result.error)
      setTruncated(result.truncated)
      setRecordCount(result.recordCount)
      setWindowDays(result.windowDays)
      setComputedAt(result.computedAt)
    } else {
      setError(result.error ?? 'Signal accuracy is unavailable right now.')
      setTruncated(false)
      setRecordCount(0)
      setWindowDays(result.windowDays)
      setComputedAt(result.computedAt)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void refresh(), REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [refresh])

  return { stats, loading, error, truncated, recordCount, windowDays, computedAt }
}

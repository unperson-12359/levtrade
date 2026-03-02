import { useEffect, useMemo, useState } from 'react'
import { SETUP_RESOLUTION_INTERVAL, SETUP_REVIEW_CANDLE_STALENESS_MS, SETUP_REVIEW_CONTEXT_MS } from '../config/constants'
import { useStore } from '../store'
import { fetchCandles } from '../services/api'
import { parseCandle, type Candle, type TrackedCoin } from '../types/market'
import type { TrackedSetup } from '../types/setup'

interface HistoricalSetupReviewState {
  candles: Candle[] | null
  loading: boolean
  error: string | null
  rangeStart: number | null
}

const COVERAGE_START_TOLERANCE_MS = 60 * 60 * 1000

export function useHistoricalSetupReview(trackedSetup: TrackedSetup | null): HistoricalSetupReviewState {
  const coin = trackedSetup?.setup.coin ?? 'BTC'
  const verificationCandles = useStore((s) => s.verificationCandles[coin as TrackedCoin])
  const setVerificationCandles = useStore((s) => s.setVerificationCandles)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestWindow = useMemo(() => {
    if (!trackedSetup) {
      return null
    }

    const startTime = Math.max(0, trackedSetup.setup.generatedAt - SETUP_REVIEW_CONTEXT_MS)
    return {
      coin: trackedSetup.setup.coin,
      startTime,
    }
  }, [trackedSetup])

  const hasRequestedCoverage = useMemo(() => {
    if (!requestWindow) {
      return false
    }

    return hasCoverage(verificationCandles, requestWindow.startTime, Date.now())
  }, [requestWindow, verificationCandles])

  useEffect(() => {
    if (!requestWindow) {
      setLoading(false)
      setError(null)
      return
    }

    const now = Date.now()
    if (hasCoverage(verificationCandles, requestWindow.startTime, now)) {
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchCandles(requestWindow.coin, SETUP_RESOLUTION_INTERVAL, requestWindow.startTime, now)
      .then((rawCandles) => {
        if (cancelled) return
        const candles = rawCandles.map(parseCandle)
        setVerificationCandles(requestWindow.coin, candles)
      })
      .catch((err) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Failed to load historical review candles'
        setError(message)
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [requestWindow, setVerificationCandles, verificationCandles])

  return {
    candles: requestWindow && hasRequestedCoverage ? verificationCandles : null,
    loading: Boolean(requestWindow) && (loading || (!hasRequestedCoverage && !error)),
    error,
    rangeStart: requestWindow?.startTime ?? null,
  }
}

function hasCoverage(candles: Candle[], startTime: number, now: number): boolean {
  if (candles.length === 0) {
    return false
  }

  const first = candles[0]!.time
  const last = candles[candles.length - 1]!.time

  return first <= startTime + COVERAGE_START_TOLERANCE_MS && last >= now - SETUP_REVIEW_CANDLE_STALENESS_MS
}

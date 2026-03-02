import { useEffect, useMemo, useRef } from 'react'
import { useStore } from '../store'
import { computeSuggestedSetup } from '../signals/setup'
import { useSignals } from './useSignals'
import type { TrackedCoin } from '../types'

export function useSuggestedSetup(coin: TrackedCoin) {
  const { signals } = useSignals(coin)
  const currentPrice = useStore((s) => s.prices[coin])
  const trackSetup = useStore((s) => s.trackSetup)
  const lastTrackedSetupRef = useRef<string>('')

  const setup = useMemo(() => {
    if (!signals || signals.isWarmingUp || signals.isStale || !currentPrice) {
      return null
    }

    return computeSuggestedSetup(coin, signals, currentPrice)
  }, [coin, currentPrice, signals])

  useEffect(() => {
    if (!setup) {
      return
    }

    const trackedBucket = `${setup.coin}-${Math.floor(setup.generatedAt / 60_000)}`
    if (trackedBucket === lastTrackedSetupRef.current) {
      return
    }

    lastTrackedSetupRef.current = trackedBucket
    trackSetup(setup)
  }, [setup, trackSetup])

  return setup
}

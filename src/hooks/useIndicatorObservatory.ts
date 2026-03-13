import { useEffect, useMemo, useState } from 'react'
import { buildObservatorySnapshot } from '../observatory/engine'
import { buildPriceContext, type PriceContext } from '../observatory/priceContext'
import type { ObservatorySnapshot } from '../observatory/types'
import { useStore } from '../store'
import type { TrackedCoin } from '../types/market'

export type ObservatoryLiveStatus = 'live' | 'updating' | 'delayed' | 'disconnected'

interface ObservatorySnapshotResponse {
  ok?: boolean
  snapshot?: ObservatorySnapshot
  priceContext?: PriceContext
  meta?: {
    freshness?: 'fresh' | 'delayed' | 'stale' | 'error'
    source?: string
  }
}

function normalizeSnapshot(snapshot: ObservatorySnapshot): ObservatorySnapshot {
  const anySnapshot = snapshot as ObservatorySnapshot & {
    health?: ObservatorySnapshot['health']
    barStates?: ObservatorySnapshot['barStates']
  }
  const snapshotWithHealth: ObservatorySnapshot = anySnapshot.health
    ? snapshot
    : {
        ...snapshot,
        health: {
          status: 'healthy',
          total: snapshot.indicators.length,
          valid: snapshot.indicators.length,
          warnings: [],
        },
      }

  const intervalMs = 24 * 60 * 60 * 1000

  const timeline = snapshotWithHealth.timeline.map((cluster) => {
    const anyCluster = cluster as typeof cluster & {
      events?: typeof cluster.topHits
      price?: typeof cluster.price
    }
    const events = Array.isArray(anyCluster.events) ? anyCluster.events : cluster.topHits
    const normalizedEvents = events.map((event) => {
      const durationBars = Number.isFinite(event.durationBars) && event.durationBars > 0 ? event.durationBars : 1
      const durationMs = Number.isFinite(event.durationMs) && event.durationMs > 0
        ? event.durationMs
        : durationBars * intervalMs
      return {
        ...event,
        durationBars,
        durationMs,
      }
    })

    const laneCounts = { ...cluster.laneCounts }
    if (Object.keys(laneCounts).length === 0 && normalizedEvents.length > 0) {
      for (const event of normalizedEvents) {
        laneCounts[event.category] = (laneCounts[event.category] ?? 0) + 1
      }
    }

    const topHits = cluster.topHits.length > 0 ? cluster.topHits : normalizedEvents.slice(0, 3)
    const totalHits = Math.max(cluster.totalHits, normalizedEvents.length)

    return {
      ...cluster,
      price: anyCluster.price ?? {
        open: 0,
        high: 0,
        low: 0,
        close: 0,
        changePct: 0,
        rangePct: 0,
      },
      totalHits,
      events: normalizedEvents,
      topHits,
      overflowCount: Math.max(0, totalHits - topHits.length),
      laneCounts,
    }
  })

  return {
    ...snapshotWithHealth,
    barStates: Array.isArray(anySnapshot.barStates) && anySnapshot.barStates.length > 0
      ? anySnapshot.barStates
      : timeline.map((cluster) => ({
          time: cluster.time,
          activeCount: cluster.totalHits,
          laneCounts: cluster.laneCounts,
          activeIndicatorIds: cluster.events.map((event) => event.indicatorId),
        })),
    timeline,
  }
}

export function useIndicatorObservatory(coin: TrackedCoin) {
  const interval = useStore((state) => state.selectedInterval)
  const candles = useStore((state) => state.candles[coin][interval])
  const livePrice = useStore((state) => state.prices[coin])
  const lastUpdate = useStore((state) => state.lastUpdate)

  const observatoryInterval = '1d' as const
  const requestKey = `${coin}:${observatoryInterval}`

  const localSnapshot = useMemo(
    () =>
      buildObservatorySnapshot({
        coin,
        interval: observatoryInterval,
        candles,
      }),
    [candles, coin, observatoryInterval],
  )

  const localPriceContext = useMemo(() => {
    return buildPriceContext({
      candles,
      interval: observatoryInterval,
      livePrice,
      livePriceObservedAtMs: lastUpdate,
    })
  }, [candles, lastUpdate, observatoryInterval, livePrice])

  const [remoteSnapshot, setRemoteSnapshot] = useState<ObservatorySnapshot | null>(null)
  const [remotePriceContext, setRemotePriceContext] = useState<PriceContext | null>(null)
  const [remoteKey, setRemoteKey] = useState<string | null>(null)
  const [freshness, setFreshness] = useState<'fresh' | 'delayed' | 'stale' | 'error'>('stale')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setRemoteSnapshot(null)
    setRemotePriceContext(null)
    setRemoteKey(requestKey)
    setFreshness('stale')

    if (import.meta.env.VITE_E2E_MOCK === '1') {
      setRemoteSnapshot(null)
      setRemotePriceContext(null)
      setRemoteKey(null)
      setFreshness('fresh')
      setLoading(false)
      return
    }

    let active = true
    let hasLoaded = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const controller = new AbortController()

    const pull = async () => {
      if (!hasLoaded) setLoading(true)
      try {
        const response = await fetch(`/api/observatory-snapshot?coin=${coin}&interval=${observatoryInterval}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload = (await response.json()) as ObservatorySnapshotResponse
        if (!active || payload.ok !== true || !payload.snapshot) return

        setRemoteSnapshot(normalizeSnapshot(payload.snapshot))
        setRemotePriceContext(payload.priceContext ?? null)
        setRemoteKey(requestKey)
        setFreshness(payload.meta?.freshness ?? 'fresh')
        hasLoaded = true
      } catch {
        if (!active) return
        setFreshness('error')
      } finally {
        if (active) {
          setLoading(false)
          timer = setTimeout(pull, 60_000)
        }
      }
    }

    void pull()
    return () => {
      active = false
      controller.abort()
      if (timer) clearTimeout(timer)
    }
  }, [coin, observatoryInterval, requestKey])

  const hasMatchingRemote = remoteKey === requestKey
  const snapshot = hasMatchingRemote ? (remoteSnapshot ?? localSnapshot) : localSnapshot
  const priceContext = hasMatchingRemote ? (remotePriceContext ?? localPriceContext) : localPriceContext
  const liveStatus: ObservatoryLiveStatus =
    import.meta.env.VITE_E2E_MOCK === '1'
      ? 'live'
      : loading && remoteSnapshot
        ? 'updating'
        : freshness === 'fresh'
          ? 'live'
          : freshness === 'delayed'
            ? 'delayed'
            : remoteSnapshot
              ? 'delayed'
              : 'disconnected'

  return {
    snapshot,
    priceContext,
    liveStatus,
    loading,
  }
}

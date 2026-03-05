import { useEffect, useMemo, useState } from 'react'
import { buildObservatorySnapshot } from '../observatory/engine'
import type { ObservatorySnapshot } from '../observatory/types'
import { useStore } from '../store'
import type { TrackedCoin } from '../types/market'

interface PriceContext {
  lastPrice: number | null
  change24hPct: number | null
  intervalReturnPct: number | null
  updatedAt: string
}

interface CanonicalResponse {
  ok?: boolean
  snapshot?: ObservatorySnapshot
  priceContext?: PriceContext
  meta?: {
    freshness?: 'fresh' | 'delayed' | 'stale' | 'error'
    source?: string
  }
}

function normalizeSnapshotHealth(snapshot: ObservatorySnapshot): ObservatorySnapshot {
  const anySnapshot = snapshot as ObservatorySnapshot & { health?: ObservatorySnapshot['health'] }
  if (anySnapshot.health) return snapshot

  const total = snapshot.indicators.length
  return {
    ...snapshot,
    health: {
      status: total > 0 ? 'warning' : 'healthy',
      total,
      valid: total,
      warnings: [],
    },
  }
}

export function useIndicatorObservatory(coin: TrackedCoin) {
  const interval = useStore((state) => state.selectedInterval)
  const candles = useStore((state) => state.candles[coin])
  const fundingHistory = useStore((state) => state.fundingHistory[coin])
  const oiHistory = useStore((state) => state.oiHistory[coin])
  const livePrice = useStore((state) => state.prices[coin])

  const canonicalInterval = interval === '1d' ? '1d' : '4h'

  const localSnapshot = useMemo(
    () =>
      buildObservatorySnapshot({
        coin,
        interval: canonicalInterval,
        candles,
        fundingHistory,
        oiHistory,
      }),
    [candles, coin, fundingHistory, canonicalInterval, oiHistory],
  )

  const localPriceContext = useMemo(() => {
    const latestClose = candles[candles.length - 1]?.close ?? null
    const lastPrice = livePrice ?? latestClose ?? null
    const barsFor24h = canonicalInterval === '4h' ? 6 : 1
    const close24hAgo = candles[Math.max(0, candles.length - 1 - barsFor24h)]?.close ?? null
    const closePrevious = candles[Math.max(0, candles.length - 2)]?.close ?? null

    return {
      lastPrice,
      change24hPct:
        lastPrice && close24hAgo && close24hAgo !== 0
          ? ((lastPrice - close24hAgo) / Math.abs(close24hAgo)) * 100
          : null,
      intervalReturnPct:
        lastPrice && closePrevious && closePrevious !== 0
          ? ((lastPrice - closePrevious) / Math.abs(closePrevious)) * 100
          : null,
      updatedAt: new Date().toISOString(),
    }
  }, [candles, canonicalInterval, livePrice])

  const [remoteSnapshot, setRemoteSnapshot] = useState<ObservatorySnapshot | null>(null)
  const [remotePriceContext, setRemotePriceContext] = useState<PriceContext | null>(null)
  const [freshness, setFreshness] = useState<'fresh' | 'delayed' | 'stale' | 'error'>('stale')
  const [source, setSource] = useState<'canonical' | 'local'>('local')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (import.meta.env.VITE_E2E_MOCK === '1') {
      setRemoteSnapshot(null)
      setRemotePriceContext(null)
      setFreshness('stale')
      setSource('local')
      setLoading(false)
      return
    }

    let active = true
    let timer: ReturnType<typeof setTimeout> | null = null
    const controller = new AbortController()

    const pull = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/observatory-snapshot?coin=${coin}&interval=${canonicalInterval}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const payload = (await response.json()) as CanonicalResponse
        if (!active || payload.ok !== true || !payload.snapshot) return

        setRemoteSnapshot(normalizeSnapshotHealth(payload.snapshot))
        setRemotePriceContext(payload.priceContext ?? null)
        setFreshness(payload.meta?.freshness ?? 'fresh')
        setSource('canonical')
      } catch {
        if (!active) return
        setRemoteSnapshot(null)
        setRemotePriceContext(null)
        setSource('local')
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
  }, [coin, canonicalInterval])

  return {
    snapshot: remoteSnapshot ?? localSnapshot,
    priceContext: remotePriceContext ?? localPriceContext,
    source,
    freshness,
    loading,
  }
}

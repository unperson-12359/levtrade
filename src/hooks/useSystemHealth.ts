import { useMemo } from 'react'
import { useStore } from '../store'

export interface SystemHealthModel {
  market: 'healthy' | 'degraded' | 'down'
  canonical: 'healthy' | 'fallback' | 'cold'
  runtime: 'healthy' | 'degraded'
  tone: 'green' | 'yellow' | 'red'
  label: string
  summary: string
}

export function useSystemHealth(): SystemHealthModel {
  const selectedCoin = useStore((state) => state.selectedCoin)
  const signals = useStore((state) => state.signals[selectedCoin])
  const connectionStatus = useStore((state) => state.connectionStatus)
  const serverTrackedSetups = useStore((state) => state.serverTrackedSetups)
  const localTrackedSetups = useStore((state) => state.localTrackedSetups)
  const runtimeDiagnostics = useStore((state) => state.runtimeDiagnostics)
  const errors = useStore((state) => state.errors)
  const canonicalFreshness = useStore((state) => state.canonicalFreshness)
  const signalAccuracyFreshness = useStore((state) => state.signalAccuracyFreshness)
  const collectorFreshness = useStore((state) => state.collectorFreshness)
  const eventStreamStatus = useStore((state) => state.eventStreamStatus)

  return useMemo(() => {
    const market =
      connectionStatus === 'error' || connectionStatus === 'disconnected'
        ? 'down'
        : connectionStatus === 'connecting' || !signals || signals.isStale || signals.isWarmingUp
          ? 'degraded'
          : 'healthy'

    const canonical =
      serverTrackedSetups.length > 0 && canonicalFreshness !== 'stale' && canonicalFreshness !== 'error'
        ? 'healthy'
        : localTrackedSetups.length > 0
          ? 'fallback'
          : 'cold'

    const runtime =
      runtimeDiagnostics.length > 0 ||
      errors.length > 0 ||
      eventStreamStatus === 'error' ||
      eventStreamStatus === 'stale'
        ? 'degraded'
        : 'healthy'

    const tone =
      market === 'down'
        ? 'red'
        : market === 'degraded' || canonical !== 'healthy' || runtime === 'degraded'
          ? 'yellow'
          : 'green'

    const label =
      tone === 'green'
        ? 'HEALTHY'
        : tone === 'yellow'
          ? 'DEGRADED'
          : 'DOWN'

    const marketText =
      market === 'healthy'
        ? 'Market data live'
        : market === 'degraded'
          ? 'Market data warming/stale'
          : 'Market data offline'

    const canonicalText =
      canonical === 'healthy'
        ? `Canonical history ${canonicalFreshness}`
        : canonical === 'fallback'
          ? 'Using browser fallback history'
          : 'Canonical history not hydrated yet'

    const runtimeText = runtime === 'healthy'
      ? `Runtime stable (${eventStreamStatus})`
      : `Runtime degraded (${eventStreamStatus})`

    const collectorText = `Collector ${collectorFreshness}`
    const accuracyText = `Accuracy ${signalAccuracyFreshness}`

    return {
      market,
      canonical,
      runtime,
      tone,
      label,
      summary: `${marketText} • ${canonicalText} • ${collectorText} • ${accuracyText} • ${runtimeText}`,
    }
  }, [
    canonicalFreshness,
    collectorFreshness,
    connectionStatus,
    errors.length,
    eventStreamStatus,
    localTrackedSetups.length,
    runtimeDiagnostics.length,
    serverTrackedSetups.length,
    signalAccuracyFreshness,
    signals,
  ])
}

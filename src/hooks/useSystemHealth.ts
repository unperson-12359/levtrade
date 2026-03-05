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
  const selectedCoin = useStore((s) => s.selectedCoin)
  const signals = useStore((s) => s.signals[selectedCoin])
  const connectionStatus = useStore((s) => s.connectionStatus)
  const serverTrackedSetups = useStore((s) => s.serverTrackedSetups)
  const localTrackedSetups = useStore((s) => s.localTrackedSetups)
  const runtimeDiagnostics = useStore((s) => s.runtimeDiagnostics)
  const errors = useStore((s) => s.errors)

  return useMemo(() => {
    const market =
      connectionStatus === 'error' || connectionStatus === 'disconnected'
        ? 'down'
        : connectionStatus === 'connecting' || !signals || signals.isStale || signals.isWarmingUp
          ? 'degraded'
          : 'healthy'

    const canonical = serverTrackedSetups.length > 0
      ? 'healthy'
      : localTrackedSetups.length > 0
        ? 'fallback'
        : 'cold'

    const runtime = runtimeDiagnostics.length > 0 || errors.length > 0
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
        ? 'Canonical history active'
        : canonical === 'fallback'
          ? 'Using browser fallback history'
          : 'Canonical history not hydrated yet'

    const runtimeText = runtime === 'healthy'
      ? 'Runtime stable'
      : 'Runtime diagnostics present'

    return {
      market,
      canonical,
      runtime,
      tone,
      label,
      summary: `${marketText} • ${canonicalText} • ${runtimeText}`,
    }
  }, [
    connectionStatus,
    errors.length,
    localTrackedSetups.length,
    runtimeDiagnostics.length,
    serverTrackedSetups.length,
    signals,
  ])
}

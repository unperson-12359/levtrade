import { formatUtcTime } from './timeFormat'
import type { IndicatorCategory, IndicatorHealthStatus } from './types'

const CATEGORY_ORDER: IndicatorCategory[] = ['Trend', 'Momentum', 'Volatility', 'Volume', 'Structure']

export function toneFromNumber(value: number | null): 'up' | 'down' | 'neutral' {
  if (value === null || !Number.isFinite(value)) return 'neutral'
  if (value > 0) return 'up'
  if (value < 0) return 'down'
  return 'neutral'
}

export function toneFromHealthStatus(status: IndicatorHealthStatus): 'good' | 'warn' | 'critical' {
  if (status === 'healthy') return 'good'
  if (status === 'warning') return 'warn'
  return 'critical'
}

export function resolveDisplayLiveStatus(
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error',
  liveStatus: 'live' | 'updating' | 'delayed' | 'disconnected',
): 'live' | 'updating' | 'delayed' | 'disconnected' {
  if (connectionStatus === 'error' || connectionStatus === 'disconnected') return 'disconnected'
  if (connectionStatus === 'connecting' && liveStatus === 'live') return 'updating'
  return liveStatus
}

export function formatLiveStatus(status: 'live' | 'updating' | 'delayed' | 'disconnected'): string {
  if (status === 'live') return 'Live'
  if (status === 'updating') return 'Updating'
  if (status === 'delayed') return 'Delayed'
  return 'Disconnected'
}

export function formatConnectionStatus(status: 'connecting' | 'connected' | 'disconnected' | 'error'): string {
  if (status === 'connected') return 'Feed connected'
  if (status === 'connecting') return 'Feed connecting'
  if (status === 'disconnected') return 'Feed offline'
  return 'Feed error'
}

export function formatObservedAt(observedAt: string | null): string {
  return `Observed ${formatUtcTime(observedAt)}`
}

export function formatPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '--'
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 4 })}`
}

export function formatTickerPrice(value: string | number | null | undefined, fallback: number | null): string {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseFloat(value) : Number.NaN
  if (Number.isFinite(numeric)) {
    return `$${numeric.toLocaleString(undefined, { maximumFractionDigits: numeric >= 1000 ? 0 : 2 })}`
  }
  if (fallback !== null && Number.isFinite(fallback)) {
    return `$${fallback.toLocaleString(undefined, { maximumFractionDigits: fallback >= 1000 ? 0 : 2 })}`
  }
  return '--'
}

export function formatSignedPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '--'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function formatValue(value: number | null, unit: string): string {
  if (value === null || !Number.isFinite(value)) return '--'
  if (unit === '%') return `${value.toFixed(2)}%`
  if (unit === 'bp') return `${value.toFixed(2)} bp`
  if (unit === 'z') return value.toFixed(2)
  if (unit === '0-1') return value.toFixed(3)
  return value.toFixed(2)
}

export function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '--'
  return `${(value * 100).toFixed(0)}%`
}

export function strongestCategory(cluster: { laneCounts: Partial<Record<IndicatorCategory, number>> }): IndicatorCategory | null {
  let best: IndicatorCategory | null = null
  let bestCount = -1
  for (const category of CATEGORY_ORDER) {
    const count = cluster.laneCounts[category] ?? 0
    if (count > bestCount) {
      best = category
      bestCount = count
    }
  }
  return bestCount > 0 ? best : null
}

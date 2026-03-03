import { timeAgo } from './format'

export function isContextStale(timestamp: number | null, thresholdMs: number, now = Date.now()): boolean {
  if (timestamp === null) {
    return true
  }
  return now - timestamp > thresholdMs
}

export function formatContextFreshness(timestamp: number | null, thresholdMs: number, now = Date.now()): string {
  if (timestamp === null) {
    return 'No recent refresh'
  }

  const age = timeAgo(timestamp)
  return isContextStale(timestamp, thresholdMs, now)
    ? `Stale, updated ${age}`
    : `Updated ${age}`
}

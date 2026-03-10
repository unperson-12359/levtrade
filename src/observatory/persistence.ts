import { buildIndicatorStateRecords } from './engine'
import type { IndicatorStateRecord, ObservatorySnapshot } from './types'

const INTERVAL_MS: Record<ObservatorySnapshot['interval'], number> = {
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
}

function intervalToMs(interval: ObservatorySnapshot['interval']) {
  return INTERVAL_MS[interval]
}

export function getClosedBarTimes(snapshot: ObservatorySnapshot, now = Date.now()): number[] {
  const intervalMs = intervalToMs(snapshot.interval)
  return snapshot.barStates
    .map((barState) => barState.time)
    .filter((time) => time + intervalMs <= now)
}

export function buildClosedIndicatorStateRecords(
  snapshot: ObservatorySnapshot,
  options: { now?: number } = {},
): IndicatorStateRecord[] {
  const now = options.now ?? Date.now()
  const closedBarTimes = new Set(getClosedBarTimes(snapshot, now))

  return buildIndicatorStateRecords(snapshot).filter((record) => closedBarTimes.has(record.candleTime))
}

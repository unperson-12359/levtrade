import type { OISnapshot } from '../types/market'
import { floorToHour } from './candleTime'

export function bucketOiSnapshotsHourly(history: OISnapshot[]): OISnapshot[] {
  if (history.length === 0) {
    return []
  }

  const buckets = new Map<number, OISnapshot>()
  for (const snapshot of history) {
    const bucketTime = floorToHour(snapshot.time)
    buckets.set(bucketTime, { time: bucketTime, oi: snapshot.oi })
  }

  return [...buckets.values()].sort((left, right) => left.time - right.time)
}

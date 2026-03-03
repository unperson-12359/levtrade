export const MS_PER_HOUR = 60 * 60 * 1000

export function floorToHour(timestamp: number): number {
  return Math.floor(timestamp / MS_PER_HOUR) * MS_PER_HOUR
}

export function ceilToHour(timestamp: number): number {
  const floored = floorToHour(timestamp)
  return floored === timestamp ? timestamp : floored + MS_PER_HOUR
}

export function getSetupWindowStart(generatedAt: number): number {
  return floorToHour(generatedAt)
}

export function getSetupWindowBoundary(generatedAt: number, windowMs: number): number {
  return generatedAt + windowMs
}

export function getResolutionBucketStart(generatedAt: number, windowMs: number): number {
  return floorToHour(generatedAt + windowMs)
}

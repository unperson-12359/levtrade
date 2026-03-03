export const MS_PER_HOUR = 60 * 60 * 1000

export function floorToHour(timestamp: number): number {
  return Math.floor(timestamp / MS_PER_HOUR) * MS_PER_HOUR
}

export function ceilToHour(timestamp: number): number {
  const floored = floorToHour(timestamp)
  return floored === timestamp ? timestamp : floored + MS_PER_HOUR
}

export function getSetupWindowStart(generatedAt: number): number {
  return ceilToHour(generatedAt)
}

export function getSetupWindowBoundary(generatedAt: number, windowMs: number): number {
  return getSetupWindowStart(generatedAt) + windowMs
}

export function getResolutionBucketStart(generatedAt: number, windowMs: number): number {
  return getSetupWindowBoundary(generatedAt, windowMs) - MS_PER_HOUR
}

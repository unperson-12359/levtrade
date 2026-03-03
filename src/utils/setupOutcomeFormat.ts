import { SETUP_WINDOWS } from '../signals/resolveOutcome'
import type { SetupWindow } from '../types/setup'
import { getSetupWindowBoundary } from './candleTime'

interface PendingOutcomeDisplay {
  label: string
  note: string
  eligibleAt: number
}

export function getPendingOutcomeDisplay(
  generatedAt: number,
  window: SetupWindow,
  now = Date.now(),
): PendingOutcomeDisplay {
  const eligibleAt = getSetupWindowBoundary(generatedAt, SETUP_WINDOWS[window])

  if (now < eligibleAt) {
    return {
      label: 'PENDING',
      note: `until ${formatSetupOutcomeTimestamp(eligibleAt)}`,
      eligibleAt,
    }
  }

  return {
    label: 'PENDING',
    note: `awaiting 1h candles since ${formatSetupOutcomeTimestamp(eligibleAt)}`,
    eligibleAt,
  }
}

export function formatSetupOutcomeTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

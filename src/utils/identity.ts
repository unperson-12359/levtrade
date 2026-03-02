import type { SuggestedSetup } from '../types/setup'
import type { TrackedDirection, TrackedSignalRecord } from '../types/tracker'

const PRICE_KEY_DECIMALS = 4

export function normalizePriceKey(value: number): string {
  if (!isFinite(value)) {
    return 'na'
  }

  return Number(value.toFixed(PRICE_KEY_DECIMALS)).toString()
}

export function buildSetupId(
  setup: Pick<SuggestedSetup, 'coin' | 'direction' | 'generatedAt' | 'entryPrice' | 'stopPrice' | 'targetPrice'>,
): string {
  return [
    'setup',
    setup.coin,
    setup.direction,
    String(setup.generatedAt),
    normalizePriceKey(setup.entryPrice),
    normalizePriceKey(setup.stopPrice),
    normalizePriceKey(setup.targetPrice),
  ].join(':')
}

export function buildTrackedSignalId(
  input: Pick<TrackedSignalRecord, 'coin' | 'kind' | 'timestamp' | 'direction' | 'label' | 'strength'>,
): string {
  return [
    'signal',
    input.coin,
    input.kind,
    String(input.timestamp),
    normalizeDirectionKey(input.direction),
    sanitizeKey(input.label),
    strengthBucket(input.strength),
  ].join(':')
}

export function strengthBucket(value: number): 'low' | 'medium' | 'high' {
  if (value >= 0.66) return 'high'
  if (value >= 0.33) return 'medium'
  return 'low'
}

function sanitizeKey(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return normalized || 'na'
}

function normalizeDirectionKey(direction: TrackedDirection | string): string {
  if (direction === 'long' || direction === 'short' || direction === 'neutral') {
    return direction
  }

  return 'na'
}

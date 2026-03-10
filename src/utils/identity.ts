import type { SuggestedSetup } from '../types/setup'

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

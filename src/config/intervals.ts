export type CandleInterval = '1h' | '4h' | '1d'

export const INTERVALS: CandleInterval[] = ['1h', '4h', '1d']

export const INTERVAL_CONFIG: Record<CandleInterval, {
  ms: number
  periodsPerYear: number
  candleCount: number
  staleAfterMs: number
  fundingLookbackMs: number
  label: string
}> = {
  '1h': {
    ms: 3_600_000,
    periodsPerYear: 8760,
    candleCount: 120,
    staleAfterMs: 2 * 3_600_000,
    fundingLookbackMs: 30 * 3_600_000,
    label: '1h',
  },
  '4h': {
    ms: 14_400_000,
    periodsPerYear: 2190,
    candleCount: 120,
    staleAfterMs: 8 * 3_600_000,
    fundingLookbackMs: 120 * 3_600_000,
    label: '4h',
  },
  '1d': {
    ms: 86_400_000,
    periodsPerYear: 365,
    candleCount: 120,
    staleAfterMs: 48 * 3_600_000,
    fundingLookbackMs: 720 * 3_600_000,
    label: '1d',
  },
}

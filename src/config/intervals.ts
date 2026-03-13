export type ObservatoryCandleInterval = '1d'

export const INTERVALS: ObservatoryCandleInterval[] = ['1d']

export const INTERVAL_CONFIG: Record<ObservatoryCandleInterval, {
  ms: number
  candleCount: number
  recentRefreshBars: number
  staleAfterMs: number
  label: string
}> = {
  '1d': {
    ms: 86_400_000,
    candleCount: 365,
    recentRefreshBars: 6,
    staleAfterMs: 48 * 3_600_000,
    label: '1d',
  },
}

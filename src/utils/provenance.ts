export type SignalSeriesKind =
  | 'zScore'
  | 'hurst'
  | 'atr'
  | 'fundingRate'
  | 'distanceFromMean'
  | 'stretchZ'

export interface SignalProvenance {
  title: string
  description: string
  source: string
  unit: string
  requestType: string
  timeframe: string
  lookback: string
  updateCadence: string
  referenceLines: Array<{ value: number; label: string; color: string }>
}

export const SIGNAL_PROVENANCE: Record<SignalSeriesKind, SignalProvenance> = {
  zScore: {
    title: 'Price Z-Score (Price Stretch)',
    description:
      'How many standard deviations the current price is from its 20-hour average. Values above +2 or below -2 suggest the price has stretched far and may snap back.',
    source: 'Computed from Hyperliquid hourly candles.',
    unit: 'σ',
    requestType: 'candleSnapshot',
    timeframe: '1h',
    lookback: '20 periods',
    updateCadence: 'Live mids update continuously; candles refresh hourly with 60s polling.',
    referenceLines: [
      { value: 2, label: 'Overbought (+2σ)', color: '#ef4444' },
      { value: -2, label: 'Oversold (-2σ)', color: '#22c55e' },
      { value: 0, label: 'Mean', color: 'rgba(255,255,255,0.15)' },
    ],
  },
  hurst: {
    title: 'Hurst Exponent (Market Regime)',
    description:
      'Approximation via lag-1 autocorrelation over 100 candles. Above 0.55 = trending. Below 0.45 = mean-reverting. Around 0.5 = random walk/chop.',
    source: 'Computed from Hyperliquid hourly candles.',
    unit: '',
    requestType: 'candleSnapshot',
    timeframe: '1h',
    lookback: '100 periods',
    updateCadence: 'Live mids update continuously; candles refresh hourly with 60s polling.',
    referenceLines: [
      { value: 0.55, label: 'Trending', color: '#eab308' },
      { value: 0.45, label: 'Mean-Reverting', color: '#22c55e' },
      { value: 0.5, label: 'Random Walk', color: 'rgba(255,255,255,0.15)' },
    ],
  },
  atr: {
    title: 'ATR (Average True Range)',
    description:
      'Rolling 14-period Average True Range. This measures typical hourly price movement and drives stop placement and volatility context.',
    source: 'Computed from Hyperliquid hourly OHLC candles.',
    unit: '$',
    requestType: 'candleSnapshot',
    timeframe: '1h',
    lookback: '14 periods',
    updateCadence: 'Live mids update continuously; candles refresh hourly with 60s polling.',
    referenceLines: [],
  },
  fundingRate: {
    title: 'Funding Rate History',
    description:
      'Hourly funding rate snapshots. Positive means longs pay shorts. Negative means shorts pay longs. Extremes often line up with crowding and squeezes.',
    source: 'Hyperliquid funding snapshots from history plus current asset context.',
    unit: '%',
    requestType: 'fundingHistory + metaAndAssetCtxs',
    timeframe: '1h snapshots',
    lookback: 'Up to 200 local snapshots',
    updateCadence: 'Funding history on load, then current funding refreshed every 60s.',
    referenceLines: [{ value: 0, label: 'Neutral', color: 'rgba(255,255,255,0.15)' }],
  },
  distanceFromMean: {
    title: 'Distance From 20-Period Mean',
    description:
      'Percentage distance between the current price and its 20-period simple moving average. Larger distance suggests more reversion fuel.',
    source: 'Computed from Hyperliquid hourly candles.',
    unit: '%',
    requestType: 'candleSnapshot',
    timeframe: '1h',
    lookback: '20 periods',
    updateCadence: 'Live mids update continuously; candles refresh hourly with 60s polling.',
    referenceLines: [{ value: 0, label: 'Mean', color: 'rgba(255,255,255,0.15)' }],
  },
  stretchZ: {
    title: 'Stretch Z-Score (Entry Geometry)',
    description:
      'The z-score used inside entry geometry to judge how stretched price is from its mean. Large absolute values indicate a more statistically unusual move.',
    source: 'Computed from Hyperliquid hourly candles and ATR.',
    unit: 'σ',
    requestType: 'candleSnapshot',
    timeframe: '1h',
    lookback: '20 periods',
    updateCadence: 'Live mids update continuously; candles refresh hourly with 60s polling.',
    referenceLines: [
      { value: 2, label: '+2σ Stretch', color: '#eab308' },
      { value: -2, label: '-2σ Stretch', color: '#eab308' },
      { value: 0, label: 'Mean', color: 'rgba(255,255,255,0.15)' },
    ],
  },
}

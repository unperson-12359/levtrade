import type { TrackedCoin } from './market'

export type ContextTone = 'green' | 'yellow' | 'red'

export interface FearGreedSnapshot {
  value: number | null
  classification: string | null
  timestamp: number | null
  source: 'alternative-me'
}

export interface CryptoMacroSnapshot {
  btcDominance: number | null
  totalMarketCapUsd: number | null
  totalVolumeUsd: number | null
  marketCapChange24h: number | null
  altSeasonBias: 'btc-headwind' | 'alt-tailwind' | 'neutral' | 'unknown'
  timestamp: number | null
  source: 'coingecko'
}

export interface BinanceContextSnapshot {
  fundingRate: Record<TrackedCoin, number | null>
  openInterestUsd: Record<TrackedCoin, number | null>
  fundingVsHyperliquid: Record<TrackedCoin, number | null>
  oiVsHyperliquid: Record<TrackedCoin, number | null>
  timestamp: number | null
  source: 'binance'
}

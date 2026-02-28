import type { TrackedCoin } from '../types/market'

const priceDecimals: Record<TrackedCoin, number> = {
  BTC: 2,
  ETH: 2,
  SOL: 2,
  HYPE: 4,
}

export function formatPrice(price: number, coin: TrackedCoin): string {
  const decimals = priceDecimals[coin]
  return '$' + price.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function formatPercent(value: number, decimals: number = 2): string {
  const sign = value >= 0 ? '+' : ''
  return sign + value.toFixed(decimals) + '%'
}

export function formatUSD(value: number): string {
  return '$' + Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(1) + 'B'
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M'
  if (value >= 1_000) return (value / 1_000).toFixed(1) + 'K'
  return value.toFixed(0)
}

export function formatFundingRate(rate: number): string {
  return (rate * 100).toFixed(4) + '%'
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function formatLeverage(leverage: number): string {
  return leverage.toFixed(1) + 'x'
}

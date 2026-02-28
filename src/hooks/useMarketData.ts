import { useStore } from '../store'
import type { TrackedCoin } from '../types/market'

export function useMarketData(coin: TrackedCoin) {
  const price = useStore((s) => s.prices[coin])
  const candles = useStore((s) => s.candles[coin])
  const context = useStore((s) => s.assetContexts[coin])
  const connectionStatus = useStore((s) => s.connectionStatus)
  const lastUpdate = useStore((s) => s.lastUpdate)

  const prevDayPrice = context ? parseFloat(context.prevDayPx) : null
  const dayChange = price && prevDayPrice ? ((price - prevDayPrice) / prevDayPrice) * 100 : null

  return {
    price,
    candles,
    funding: context ? parseFloat(context.funding) : null,
    openInterest: context ? parseFloat(context.openInterest) : null,
    markPrice: context ? parseFloat(context.markPx) : null,
    prevDayPrice,
    dayChange,
    dayVolume: context ? parseFloat(context.dayNtlVlm) : null,
    isConnected: connectionStatus === 'connected',
    isLoading: price === null,
    lastUpdate,
  }
}

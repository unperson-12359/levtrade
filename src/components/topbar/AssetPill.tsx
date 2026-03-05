import type { TrackedCoin } from '../../types/market'
import { useStore } from '../../store'
import { useMarketData } from '../../hooks/useMarketData'
import { useSignalDecision } from '../../hooks/useEntryDecision'
import { formatPrice } from '../../utils/format'

interface AssetPillProps {
  coin: TrackedCoin
  isBest?: boolean
}

export function AssetPill({ coin, isBest = false }: AssetPillProps) {
  const selectedCoin = useStore((s) => s.selectedCoin)
  const selectCoin = useStore((s) => s.selectCoin)
  const { price, isLoading } = useMarketData(coin)
  const decision = useSignalDecision(coin)

  const isSelected = selectedCoin === coin
  const tone = decision.color
  const arrow = decision.action === 'long' ? '\u25B2' : decision.action === 'short' ? '\u25BC' : '\u2013'
  const shortLabel = decision.action === 'long' ? 'LONG'
    : decision.action === 'short' ? 'SHORT'
    : decision.action === 'wait' ? 'WAIT' : 'AVOID'

  return (
    <button
      onClick={() => selectCoin(coin)}
      className={`asset-pill asset-pill--${tone} ${isSelected ? 'asset-pill--active' : ''} ${isBest ? 'asset-pill--best' : ''}`}
      data-testid={`asset-pill-${coin}`}
      aria-label={`Select ${coin}`}
    >
      <span className="asset-pill__symbol">{coin}</span>
      <span className="asset-pill__price">{isLoading ? '...' : price ? formatPrice(price, coin) : '--'}</span>
      <span className="asset-pill__signal">{arrow} {shortLabel}</span>
    </button>
  )
}

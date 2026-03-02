import type { TrackedCoin } from '../../types/market'
import { useStore } from '../../store'
import { useMarketData } from '../../hooks/useMarketData'
import { formatPrice } from '../../utils/format'

interface AssetPillProps {
  coin: TrackedCoin
}

export function AssetPill({ coin }: AssetPillProps) {
  const selectedCoin = useStore((s) => s.selectedCoin)
  const selectCoin = useStore((s) => s.selectCoin)
  const { price, isLoading } = useMarketData(coin)

  const isSelected = selectedCoin === coin

  return (
    <button
      onClick={() => selectCoin(coin)}
      className={`asset-pill ${isSelected ? 'asset-pill--active' : ''}`}
    >
      <span className="asset-pill__symbol">{coin}</span>
      <span className="asset-pill__price">{isLoading ? '...' : price ? formatPrice(price, coin) : '--'}</span>
    </button>
  )
}

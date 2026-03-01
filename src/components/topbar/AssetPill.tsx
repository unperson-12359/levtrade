import type { TrackedCoin } from '../../types/market'
import { useStore } from '../../store'
import { useMarketData } from '../../hooks/useMarketData'
import { useSignals } from '../../hooks/useSignals'
import { useEntryDecision } from '../../hooks/useEntryDecision'
import { TrafficLight } from '../shared/TrafficLight'
import { Tooltip } from '../shared/Tooltip'
import { formatPercent, formatPrice } from '../../utils/format'

interface AssetPillProps {
  coin: TrackedCoin
}

export function AssetPill({ coin }: AssetPillProps) {
  const selectedCoin = useStore((s) => s.selectedCoin)
  const selectCoin = useStore((s) => s.selectCoin)
  const { price, dayChange, isLoading } = useMarketData(coin)
  const { regimeColor, signalColor } = useSignals(coin)
  const decision = useEntryDecision(coin)

  const isSelected = selectedCoin === coin
  const dayTone = dayChange !== null && dayChange >= 0 ? 'text-signal-green' : 'text-signal-red'
  const riskColor = decision.riskStatus === 'safe' ? 'green' : decision.riskStatus === 'borderline' ? 'yellow' : decision.riskStatus === 'danger' ? 'red' : 'yellow'

  return (
    <button
      onClick={() => selectCoin(coin)}
      className={`asset-pill ${isSelected ? 'asset-pill--active' : ''}`}
    >
      <div className="asset-pill__meta">
        <div className="asset-pill__row">
          <span className="asset-pill__symbol">{coin}</span>
          {dayChange !== null && <span className={`asset-pill__change ${dayTone}`}>{formatPercent(dayChange, 1)}</span>}
        </div>
        <div className="asset-pill__price">{isLoading ? '...' : price ? formatPrice(price, coin) : '--'}</div>
      </div>

      <div className="asset-pill__lights">
        <Tooltip content="Step 1: Regime — Is the market favorable?">
          <TrafficLight color={regimeColor} size="sm" label="Regime" />
        </Tooltip>
        <Tooltip content="Step 2: Signal — Is there a trade setup?">
          <TrafficLight color={signalColor} size="sm" label="Signal" />
        </Tooltip>
        <Tooltip content="Step 3: Risk — Is the position sized correctly?">
          <TrafficLight color={riskColor} size="sm" label="Risk" />
        </Tooltip>
      </div>

      <span className={`asset-pill__decision asset-pill__decision--${decision.color}`}>
        {decision.label.replace('ENTER ', '')}
      </span>
    </button>
  )
}

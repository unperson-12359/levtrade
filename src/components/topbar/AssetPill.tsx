import type { TrackedCoin } from '../../types/market'
import { useStore } from '../../store'
import { useMarketData } from '../../hooks/useMarketData'
import { useSignals } from '../../hooks/useSignals'
import { TrafficLight } from '../shared/TrafficLight'
import { formatPrice, formatPercent } from '../../utils/format'
import { SIGNAL_TEXT_CLASSES } from '../../utils/colors'

interface AssetPillProps {
  coin: TrackedCoin
}

export function AssetPill({ coin }: AssetPillProps) {
  const selectedCoin = useStore((s) => s.selectedCoin)
  const selectCoin = useStore((s) => s.selectCoin)
  const { price, dayChange, isLoading } = useMarketData(coin)
  const { regimeColor, signalColor, overallStatus, overallStatusColor } = useSignals(coin)

  const isSelected = selectedCoin === coin
  const changeColor = dayChange && dayChange >= 0 ? 'text-signal-green' : 'text-signal-red'

  return (
    <button
      onClick={() => selectCoin(coin)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200 shrink-0 ${
        isSelected
          ? 'border-signal-blue/40 bg-signal-blue/5'
          : 'border-border-subtle bg-bg-card hover:bg-bg-card-hover'
      }`}
    >
      {/* Coin name & price */}
      <div className="text-left">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-text-primary">{coin}</span>
          {dayChange !== null && (
            <span className={`font-mono text-[10px] ${changeColor}`}>
              {formatPercent(dayChange, 1)}
            </span>
          )}
        </div>
        <div className="font-mono text-[11px] text-text-secondary">
          {isLoading ? '...' : price ? formatPrice(price, coin) : '—'}
        </div>
      </div>

      {/* Traffic lights */}
      <div className="flex items-center gap-1">
        <TrafficLight color={regimeColor} size="sm" label="Regime" />
        <TrafficLight color={signalColor} size="sm" label="Signal" />
        <TrafficLight color="yellow" size="sm" label="Risk" />
      </div>

      {/* Overall status */}
      {overallStatus && (
        <span className={`text-[9px] font-bold tracking-wider ${SIGNAL_TEXT_CLASSES[overallStatusColor]}`}>
          {overallStatus}
        </span>
      )}
    </button>
  )
}

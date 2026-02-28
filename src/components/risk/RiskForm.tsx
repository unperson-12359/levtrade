import { TRACKED_COINS, type TrackedCoin } from '../../types/market'
import type { TradeDirection } from '../../types/risk'
import { usePositionRisk } from '../../hooks/usePositionRisk'
import { useMarketData } from '../../hooks/useMarketData'
import { formatPrice, formatLeverage } from '../../utils/format'
import { leverageColor } from '../../utils/colors'
import { SIGNAL_COLORS } from '../../utils/colors'

export function RiskForm() {
  const { inputs, updateInput } = usePositionRisk()
  const { price } = useMarketData(inputs.coin)

  const levColor = leverageColor(inputs.leverage)

  return (
    <div className="space-y-5">
      {/* Asset Selector */}
      <div>
        <label className="block text-sm font-medium text-text-muted mb-1.5">Asset</label>
        <div className="flex gap-2">
          {TRACKED_COINS.map((coin) => (
            <button
              key={coin}
              onClick={() => {
                updateInput('coin', coin as TrackedCoin)
                if (price) updateInput('entryPrice', price)
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                inputs.coin === coin
                  ? 'border-signal-blue/40 bg-signal-blue/10 text-text-primary'
                  : 'border-border-subtle bg-bg-input text-text-secondary hover:bg-bg-card-hover'
              }`}
            >
              {coin}
            </button>
          ))}
        </div>
      </div>

      {/* Direction Toggle */}
      <div>
        <label className="block text-sm font-medium text-text-muted mb-1.5">Direction</label>
        <div className="flex gap-2">
          {(['long', 'short'] as TradeDirection[]).map((dir) => (
            <button
              key={dir}
              onClick={() => updateInput('direction', dir)}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${
                inputs.direction === dir
                  ? dir === 'long'
                    ? 'border-signal-green/40 bg-signal-green/10 text-signal-green'
                    : 'border-signal-red/40 bg-signal-red/10 text-signal-red'
                  : 'border-border-subtle bg-bg-input text-text-secondary hover:bg-bg-card-hover'
              }`}
            >
              {dir.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Entry Price */}
      <div>
        <label className="block text-sm font-medium text-text-muted mb-1.5">
          Entry Price
          {price && (
            <button
              onClick={() => updateInput('entryPrice', price)}
              className="ml-2 text-signal-blue text-sm hover:underline"
            >
              Use current ({formatPrice(price, inputs.coin)})
            </button>
          )}
        </label>
        <input
          type="number"
          value={inputs.entryPrice || ''}
          onChange={(e) => updateInput('entryPrice', parseFloat(e.target.value) || 0)}
          className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-input text-text-primary font-mono text-base focus:border-border-focus focus:outline-none"
          placeholder="0.00"
        />
      </div>

      {/* Account Size */}
      <div>
        <label className="block text-sm font-medium text-text-muted mb-1.5">Account Size (USD)</label>
        <input
          type="number"
          value={inputs.accountSize || ''}
          onChange={(e) => updateInput('accountSize', parseFloat(e.target.value) || 0)}
          className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-input text-text-primary font-mono text-base focus:border-border-focus focus:outline-none"
          placeholder="1000"
        />
      </div>

      {/* Position Size */}
      <div>
        <label className="block text-sm font-medium text-text-muted mb-1.5">Position Size (USD)</label>
        <input
          type="number"
          value={inputs.positionSize || ''}
          onChange={(e) => updateInput('positionSize', parseFloat(e.target.value) || 0)}
          className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-input text-text-primary font-mono text-base focus:border-border-focus focus:outline-none"
          placeholder="100"
        />
      </div>

      {/* Leverage Slider */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label className="text-sm font-medium text-text-muted">Leverage</label>
          <span
            className="font-mono text-sm font-bold"
            style={{ color: SIGNAL_COLORS[levColor] }}
          >
            {formatLeverage(inputs.leverage)}
          </span>
        </div>
        {/* Gradient track behind slider */}
        <div className="relative">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full" style={{
            background: 'linear-gradient(to right, var(--color-signal-green) 0%, var(--color-signal-yellow) 30%, var(--color-signal-red) 100%)',
            opacity: 0.3,
          }} />
          <input
            type="range"
            min={1}
            max={50}
            step={0.5}
            value={inputs.leverage}
            onChange={(e) => updateInput('leverage', parseFloat(e.target.value))}
            className="relative w-full leverage-slider"
            style={{ '--lev-pct': `${((inputs.leverage - 1) / 49) * 100}%` } as React.CSSProperties}
          />
        </div>
        {/* Tick marks */}
        <div className="relative mt-1 h-4">
          {[1, 25, 50].map((tick) => {
            const pct = ((tick - 1) / 49) * 100
            return (
              <button
                key={tick}
                onClick={() => updateInput('leverage', tick)}
                className="absolute -translate-x-1/2 text-sm text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
                style={{ left: `${pct}%` }}
              >
                {tick}x
              </button>
            )
          })}
        </div>
      </div>

      {/* Stop Price (optional) */}
      <div>
        <label className="block text-sm font-medium text-text-muted mb-1.5">
          Stop Loss Price <span className="text-text-muted">(optional)</span>
        </label>
        <input
          type="number"
          value={inputs.stopPrice ?? ''}
          onChange={(e) => {
            const val = parseFloat(e.target.value)
            updateInput('stopPrice', isNaN(val) ? null : val)
          }}
          className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-input text-text-primary font-mono text-base focus:border-border-focus focus:outline-none"
          placeholder="Auto (1.5x ATR)"
        />
      </div>

      {/* Target Price (optional) */}
      <div>
        <label className="block text-sm font-medium text-text-muted mb-1.5">
          Target Price <span className="text-text-muted">(optional)</span>
        </label>
        <input
          type="number"
          value={inputs.targetPrice ?? ''}
          onChange={(e) => {
            const val = parseFloat(e.target.value)
            updateInput('targetPrice', isNaN(val) ? null : val)
          }}
          className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-input text-text-primary font-mono text-base focus:border-border-focus focus:outline-none"
          placeholder="Auto (2:1 R:R)"
        />
      </div>
    </div>
  )
}

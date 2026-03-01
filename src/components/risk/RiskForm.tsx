import type { CSSProperties } from 'react'
import type { TradeDirection } from '../../types/risk'
import { TRACKED_COINS } from '../../types/market'
import { usePositionRisk } from '../../hooks/usePositionRisk'
import { useMarketData } from '../../hooks/useMarketData'
import { useStore } from '../../store'
import { leverageColor, SIGNAL_COLORS } from '../../utils/colors'
import { formatLeverage, formatPrice } from '../../utils/format'

export function RiskForm() {
  const { inputs, updateInput } = usePositionRisk()
  const selectCoin = useStore((s) => s.selectCoin)
  const prices = useStore((s) => s.prices)
  const { price } = useMarketData(inputs.coin)
  const levColor = leverageColor(inputs.leverage)

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-text-muted mb-1.5">Asset</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TRACKED_COINS.map((coin) => (
            <button
              key={coin}
              onClick={() => {
                selectCoin(coin)
                const nextPrice = prices[coin]
                if (nextPrice) updateInput('entryPrice', nextPrice)
              }}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
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

      <div>
        <label className="block text-sm font-medium text-text-muted mb-1.5">Direction</label>
        <div className="grid grid-cols-2 gap-2">
          {(['long', 'short'] as TradeDirection[]).map((dir) => (
            <button
              key={dir}
              onClick={() => updateInput('direction', dir)}
              className={`rounded-lg border px-4 py-2 text-sm font-bold transition-colors ${
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

      <NumberField
        label="Entry Price"
        value={inputs.entryPrice || ''}
        onChange={(value) => updateInput('entryPrice', value)}
        helper={price ? `Live ${formatPrice(price, inputs.coin)}` : undefined}
        helperAction={price ? () => updateInput('entryPrice', price) : undefined}
        helperLabel={price ? 'Use current' : undefined}
        placeholder="0.00"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NumberField
          label="Account Size"
          value={inputs.accountSize || ''}
          onChange={(value) => updateInput('accountSize', value)}
          placeholder="1000"
        />
        <NumberField
          label="Position Size"
          value={inputs.positionSize || ''}
          onChange={(value) => updateInput('positionSize', value)}
          placeholder="100"
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-medium text-text-muted">Leverage</label>
          <span className="font-mono text-sm font-bold" style={{ color: SIGNAL_COLORS[levColor] }}>
            {formatLeverage(inputs.leverage)}
          </span>
        </div>
        <div className="relative">
          <div
            className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full"
            style={{
              background: 'linear-gradient(to right, var(--color-signal-green) 0%, var(--color-signal-yellow) 35%, var(--color-signal-red) 100%)',
              opacity: 0.3,
            }}
          />
          <input
            type="range"
            min={1}
            max={50}
            step={0.5}
            value={inputs.leverage}
            onChange={(event) => updateInput('leverage', parseFloat(event.target.value))}
            className="relative w-full leverage-slider"
            style={{ '--lev-pct': `${((inputs.leverage - 1) / 49) * 100}%` } as CSSProperties}
          />
        </div>
        <div className="mt-1 flex justify-between text-sm text-text-muted">
          {[1, 5, 15, 30, 50].map((tick) => (
            <button key={tick} onClick={() => updateInput('leverage', tick)} className="hover:text-text-secondary">
              {tick}x
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NumberField
          label="Stop Price"
          value={inputs.stopPrice ?? ''}
          onChange={(value) => updateInput('stopPrice', value > 0 ? value : null)}
          placeholder="Auto (1.5x ATR)"
        />
        <NumberField
          label="Target Price"
          value={inputs.targetPrice ?? ''}
          onChange={(value) => updateInput('targetPrice', value > 0 ? value : null)}
          placeholder="Auto (2:1 R:R)"
        />
      </div>
    </div>
  )
}

interface NumberFieldProps {
  label: string
  value: number | ''
  onChange: (value: number) => void
  placeholder: string
  helper?: string
  helperLabel?: string
  helperAction?: () => void
}

function NumberField({ label, value, onChange, placeholder, helper, helperAction, helperLabel }: NumberFieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-text-muted">
        {label}
        {helper && helperAction && helperLabel && (
          <button onClick={helperAction} className="ml-2 text-signal-blue text-sm hover:underline">
            {helperLabel}
          </button>
        )}
      </label>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(parseFloat(event.target.value) || 0)}
        className="w-full rounded-lg border border-border-subtle bg-bg-input px-3 py-2 font-mono text-base text-text-primary focus:border-border-focus focus:outline-none"
        placeholder={placeholder}
      />
      {helper && <div className="mt-1 text-sm text-text-muted">{helper}</div>}
    </div>
  )
}

import { useState, useRef } from 'react'
import type { TradeDirection } from '../../types/risk'
import { TRACKED_COINS } from '../../types/market'
import { usePositionRisk } from '../../hooks/usePositionRisk'
import { useMarketData } from '../../hooks/useMarketData'
import { useStore } from '../../store'
import { SIGNAL_COLORS } from '../../utils/colors'
import { formatUSD } from '../../utils/format'

const LEVERAGE_CHIPS = [1, 5, 10, 20, 40]
const MAX_LEVERAGE = 40

/**
 * Local-string-state wrapper for numeric inputs.
 * Keeps raw text during editing so keystrokes are never eaten;
 * commits a parsed (and optionally clamped) number to the store on blur / Enter.
 * Eagerly commits valid numbers on each keystroke for live derived-value feedback.
 */
function useNumericInput(
  storeValue: number,
  commit: (v: number) => void,
  opts?: { min?: number; max?: number; fallback?: number }
) {
  const [text, setText] = useState(storeValue ? String(storeValue) : '')
  const prev = useRef(storeValue)

  // Sync from store when the value changes externally
  // (e.g. "Use current" button, leverage chips, coin switch)
  if (storeValue !== prev.current) {
    prev.current = storeValue
    setText(storeValue ? String(storeValue) : '')
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setText(raw)
    // Eagerly commit valid numbers so derived values (notional, verdicts) update live
    const n = parseFloat(raw)
    if (!isNaN(n)) {
      let v = n
      if (opts?.min != null) v = Math.max(opts.min, v)
      if (opts?.max != null) v = Math.min(opts.max, v)
      commit(v)
      prev.current = v
    }
  }

  const handleBlur = () => {
    let n = parseFloat(text)
    if (isNaN(n)) n = opts?.fallback ?? 0
    if (opts?.min != null) n = Math.max(opts.min, n)
    if (opts?.max != null) n = Math.min(opts.max, n)
    commit(n)
    setText(n ? String(n) : '')
    prev.current = n
  }

  return {
    value: text,
    onChange: handleChange,
    onBlur: handleBlur,
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') (e.target as HTMLElement).blur() },
  }
}

export function RiskForm() {
  const { inputs, outputs, updateInput } = usePositionRisk()
  const selectCoin = useStore((s) => s.selectCoin)
  const prices = useStore((s) => s.prices)
  const { price } = useMarketData(inputs.coin)
  const notional = inputs.positionSize > 0 ? inputs.positionSize * inputs.leverage : 0

  const entryPrice = useNumericInput(inputs.entryPrice, (v) => updateInput('entryPrice', v))
  const capital = useNumericInput(inputs.accountSize, (v) => updateInput('accountSize', v))
  const margin = useNumericInput(inputs.positionSize, (v) => updateInput('positionSize', v))
  const leverageInput = useNumericInput(inputs.leverage, (v) => updateInput('leverage', v), { min: 1, max: MAX_LEVERAGE, fallback: 1 })
  const stopPrice = useNumericInput(inputs.stopPrice ?? 0, (v) => updateInput('stopPrice', v > 0 ? v : null))
  const targetPrice = useNumericInput(inputs.targetPrice ?? 0, (v) => updateInput('targetPrice', v > 0 ? v : null))

  return (
    <div className="space-y-3">
      {/* Row 1: Asset + Direction */}
      <div className="flex items-end gap-3">
        <div className="flex-1 min-w-0">
          <label className="block text-sm font-medium text-text-muted mb-1">Asset</label>
          <div className="grid grid-cols-4 gap-1.5">
            {TRACKED_COINS.map((coin) => (
              <button
                key={coin}
                onClick={() => {
                  if (inputs.coin !== coin) {
                    selectCoin(coin)
                    const nextPrice = prices[coin]
                    if (nextPrice) updateInput('entryPrice', nextPrice)
                  }
                }}
                className={`rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors ${
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
        <div className="shrink-0">
          <label className="block text-sm font-medium text-text-muted mb-1">Direction</label>
          <div className="flex gap-1.5">
            {(['long', 'short'] as TradeDirection[]).map((dir) => (
              <button
                key={dir}
                onClick={() => updateInput('direction', dir)}
                className={`rounded-md border px-3 py-1.5 text-xs font-bold transition-colors ${
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
      </div>

      {/* Row 2: Entry Price (inline) */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="text-sm font-medium text-text-muted">Entry Price</label>
          {price && (
            <button
              onClick={() => updateInput('entryPrice', price)}
              className="text-xs text-signal-blue hover:underline"
            >
              Use current
            </button>
          )}
        </div>
        <input
          type="number"
          {...entryPrice}
          className="w-full rounded-lg border border-border-subtle bg-bg-input px-3 py-1.5 font-mono text-sm text-text-primary focus:border-border-focus focus:outline-none"
          placeholder="0.00"
        />
      </div>

      {/* Row 3: Capital + Margin + Leverage */}
      <div className="grid grid-cols-3 gap-2">
        <CompactField label="Capital" {...capital} placeholder="1000" />
        <CompactField label="Margin" {...margin} placeholder="100" />
        <div>
          <label className="block text-sm font-medium text-text-muted mb-1">Leverage</label>
          <div className="relative">
            <input
              type="number"
              min={1}
              max={MAX_LEVERAGE}
              step={0.5}
              {...leverageInput}
              className="w-full rounded-lg border border-border-subtle bg-bg-input px-3 py-1.5 pr-6 font-mono text-sm text-text-primary focus:border-border-focus focus:outline-none"
            />
            <span
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold pointer-events-none"
              style={{ color: SIGNAL_COLORS[inputs.leverage <= 5 ? 'green' : inputs.leverage <= 15 ? 'yellow' : 'red'] }}
            >
              x
            </span>
          </div>
        </div>
      </div>

      {/* Leverage chips + Notional display */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          {LEVERAGE_CHIPS.map((lev) => (
            <button
              key={lev}
              onClick={() => updateInput('leverage', lev)}
              className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
                inputs.leverage === lev
                  ? 'border-signal-blue/40 bg-signal-blue/10 text-text-primary'
                  : 'border-border-subtle bg-bg-input text-text-muted hover:text-text-secondary'
              }`}
            >
              {lev}x
            </button>
          ))}
        </div>
        {notional > 0 && (
          <span className="text-xs text-text-muted ml-auto">
            Notional <span className="font-mono text-text-secondary">{formatUSD(notional)}</span>
          </span>
        )}
      </div>

      {/* Row 4: Stop + Target */}
      <div className="grid grid-cols-2 gap-2">
        <CompactField
          label="Stop Price"
          {...stopPrice}
          placeholder={outputs?.suggestedStopPrice ? `Auto ${outputs.suggestedStopPrice.toFixed(1)}` : 'Auto (1.5× ATR)'}
        />
        <CompactField
          label="Target Price"
          {...targetPrice}
          placeholder={outputs?.suggestedTargetPrice ? `Auto ${outputs.suggestedTargetPrice.toFixed(1)}` : 'Auto (2:1 R:R)'}
        />
      </div>
      <div className="text-xs text-text-muted -mt-1">Leave blank for auto-calculated values based on ATR and R:R.</div>
    </div>
  )
}

function CompactField({
  label,
  value,
  onChange,
  onBlur,
  onKeyDown,
  placeholder,
}: {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBlur: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  placeholder: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-muted mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className="w-full rounded-lg border border-border-subtle bg-bg-input px-3 py-1.5 font-mono text-sm text-text-primary focus:border-border-focus focus:outline-none"
        placeholder={placeholder}
      />
    </div>
  )
}

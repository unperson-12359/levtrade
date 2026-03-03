import { useState, useRef } from 'react'
import { useStore } from '../../store'
import { useSuggestedPosition } from '../../hooks/useSuggestedPosition'
import { formatPrice, formatUSD } from '../../utils/format'
import { formatLeverage } from '../../utils/format'

const CAPITAL_PRESETS = [1000, 5000, 10000, 25000]

function useNumericInput(
  storeValue: number,
  commit: (v: number) => void,
  opts?: { min?: number; fallback?: number }
) {
  const [text, setText] = useState(storeValue ? String(storeValue) : '')
  const prev = useRef(storeValue)

  if (storeValue !== prev.current) {
    prev.current = storeValue
    setText(storeValue ? String(storeValue) : '')
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setText(raw)
    const n = parseFloat(raw)
    if (!isNaN(n)) {
      let v = n
      if (opts?.min != null) v = Math.max(opts.min, v)
      commit(v)
      prev.current = v
    }
  }

  const handleBlur = () => {
    let n = parseFloat(text)
    if (isNaN(n)) n = opts?.fallback ?? 0
    if (opts?.min != null) n = Math.max(opts.min, n)
    commit(n)
    setText(n ? String(n) : '')
    prev.current = n
  }

  return {
    value: text,
    onChange: handleChange,
    onBlur: handleBlur,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') (e.target as HTMLElement).blur()
    },
  }
}

export function RiskForm() {
  const accountSize = useStore((s) => s.riskInputs.accountSize)
  const updateRiskInput = useStore((s) => s.updateRiskInput)
  const composition = useSuggestedPosition()
  const capital = useNumericInput(accountSize, (v) => updateRiskInput('accountSize', v), {
    min: 1,
    fallback: 1000,
  })
  const disabled = composition.status === 'no-setup'

  return (
    <div className="space-y-3">
      <p className="panel-copy">
        LevTrade composes the position automatically from the current setup. You only set account capital.
      </p>

      <div className={disabled ? 'opacity-60 pointer-events-none' : ''}>
        <label className="block text-sm font-medium text-text-muted mb-1">Account Capital</label>
        <input
          type="number"
          {...capital}
          readOnly={disabled}
          className="w-full rounded-lg border border-border-subtle bg-bg-input px-3 py-1.5 font-mono text-sm text-text-primary focus:border-border-focus focus:outline-none"
          placeholder="10000"
        />
      </div>

      <div className={`flex flex-wrap gap-1.5 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
        {CAPITAL_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={disabled}
            onClick={() => updateRiskInput('accountSize', preset)}
            className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
              accountSize === preset
                ? 'border-signal-blue/40 bg-signal-blue/10 text-text-primary'
                : 'border-border-subtle bg-bg-input text-text-muted hover:text-text-secondary'
            }`}
          >
            {formatUSD(preset)}
          </button>
        ))}
      </div>

      {composition.setup ? (
        <div className="stat-grid">
          <InfoCard label="Asset" value={composition.setup.coin} helper="Current setup" />
          <InfoCard label="Direction" value={composition.setup.direction.toUpperCase()} helper="From Step 2" />
          <InfoCard
            label="Entry"
            value={formatPrice(composition.setup.entryPrice, composition.setup.coin)}
            helper="Locked from setup"
          />
          <InfoCard
            label="Stop"
            value={formatPrice(composition.setup.stopPrice, composition.setup.coin)}
            helper="Locked from setup"
          />
          <InfoCard
            label="Target"
            value={formatPrice(composition.setup.targetPrice, composition.setup.coin)}
            helper="Locked from setup"
          />
          <InfoCard
            label="Suggested leverage"
            value={formatLeverage(composition.setup.suggestedLeverage)}
            helper="Derived from ATR and stop"
          />
        </div>
      ) : (
        <div className="workflow-summary-card">
          <div className="workflow-summary-card__kicker">Position composition unavailable</div>
          <p className="workflow-summary-card__copy">
            Step 3 unlocks only when Step 2 identifies a valid long or short setup.
          </p>
        </div>
      )}
    </div>
  )
}

function InfoCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="workflow-summary-card__copy">{helper}</div>
    </div>
  )
}

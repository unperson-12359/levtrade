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
  const disabled = composition.mode === 'none'
  const helperCopy =
    composition.mode === 'validated'
      ? 'LevTrade is using the confirmed Step 2 setup. You only set account capital.'
      : composition.mode === 'provisional'
        ? 'LevTrade is sizing a reduced-risk draft from the current directional bias. You only set account capital.'
        : 'LevTrade will start composing a position as soon as live directional structure appears.'

  return (
    <div className="space-y-3">
      <p className="panel-copy">{helperCopy}</p>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`status-pill status-pill--${composition.mode === 'validated' ? 'green' : composition.mode === 'provisional' ? 'yellow' : 'red'}`}>
          {composition.display.modeLabel}
        </span>
        {composition.mode !== 'none' && (
          <span className="inline-flex items-center rounded-full border border-border-subtle px-2 py-0.5 text-xs text-text-secondary">
            {composition.display.modeExplanation}
          </span>
        )}
      </div>

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
          <InfoCard
            label="Asset"
            value={composition.setup.coin}
            helper={composition.mode === 'validated' ? 'Confirmed setup' : 'Current directional bias'}
          />
          <InfoCard
            label="Direction"
            value={composition.setup.direction.toUpperCase()}
            helper={composition.mode === 'validated' ? 'Validated by Step 2' : 'Draft bias for reduced-risk sizing'}
          />
          <InfoCard
            label="Entry"
            value={formatPrice(composition.setup.entryPrice, composition.setup.coin)}
            helper={composition.mode === 'validated' ? 'Locked from setup' : 'Draft entry from live price'}
          />
          <InfoCard
            label="Stop"
            value={formatPrice(composition.setup.stopPrice, composition.setup.coin)}
            helper={composition.mode === 'validated' ? 'Locked from setup' : 'Auto-derived protective stop'}
          />
          <InfoCard
            label="Target"
            value={formatPrice(composition.setup.targetPrice, composition.setup.coin)}
            helper={composition.mode === 'validated' ? 'Locked from setup' : 'Auto-derived draft target'}
          />
          <InfoCard
            label="Suggested leverage"
            value={formatLeverage(composition.inputs.leverage)}
            helper={composition.mode === 'validated' ? 'Derived from ATR and stop' : 'Capped lower while confirmation is incomplete'}
          />
        </div>
      ) : (
        <div className="workflow-summary-card">
          <div className="workflow-summary-card__kicker">Waiting for directional structure</div>
          <p className="workflow-summary-card__copy">
            {composition.display.modeExplanation}
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

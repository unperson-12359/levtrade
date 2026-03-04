import { useState, useRef } from 'react'
import { useStore } from '../../store'
import { useSuggestedPosition } from '../../hooks/useSuggestedPosition'
import { formatLeverage, formatPrice, formatUSD } from '../../utils/format'

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
      ? 'Confirmed setup active. Set account capital and LevTrade sizes automatically.'
      : composition.mode === 'provisional'
        ? 'Draft directional composition active. Reduced-risk sizing is applied automatically.'
        : 'Waiting for directional structure before composing a position.'

  return (
    <div className="risk-form risk-form--compact">
      <div className="risk-form__mode-row">
        <span className={`status-pill status-pill--${composition.mode === 'validated' ? 'green' : composition.mode === 'provisional' ? 'yellow' : 'red'}`}>
          {composition.display.modeLabel}
        </span>
        <span className="risk-form__mode-note">{helperCopy}</span>
      </div>

      <div className="risk-form__capital-cluster">
        <div className={`risk-form__capital-row ${disabled ? 'risk-form__disabled' : ''}`}>
          <label className="risk-form__capital-label" htmlFor="risk-capital-input">Account capital</label>
          <div className="risk-form__capital-input-wrap">
            <input
              id="risk-capital-input"
              type="number"
              {...capital}
              readOnly={disabled}
              className="risk-form__capital-input"
              placeholder="10000"
            />
          </div>
        </div>

        <div className={`risk-form__preset-row ${disabled ? 'risk-form__disabled' : ''}`}>
          {CAPITAL_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              onClick={() => updateRiskInput('accountSize', preset)}
              className={`risk-form__preset ${
                accountSize === preset
                  ? 'risk-form__preset--active'
                  : 'risk-form__preset--inactive'
              }`}
            >
              {formatUSD(preset)}
            </button>
          ))}
        </div>
      </div>

      {composition.setup ? (
        <div className="risk-info-grid risk-info-grid--compact">
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
            helper={composition.mode === 'validated' ? 'Derived from setup geometry, stop width, and target account risk' : 'Derived from directional bias with a lower leverage cap and smaller allocation'}
          />
        </div>
      ) : (
        <div className="workflow-summary-card risk-form__empty">
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
    <div className="risk-info-card">
      <div className="risk-info-card__label">{label}</div>
      <div className="risk-info-card__value">{value}</div>
      <div className="risk-info-card__helper" title={helper}>{helper}</div>
    </div>
  )
}

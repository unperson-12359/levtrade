import { useState } from 'react'
import { useEntryDecision } from '../../hooks/useEntryDecision'
import { usePositionRisk } from '../../hooks/usePositionRisk'
import { useSuggestedPosition } from '../../hooks/useSuggestedPosition'
import { useSignals } from '../../hooks/useSignals'
import { useStore } from '../../store'
import type { SignalSeriesKind } from '../../utils/provenance'
import { getEntryWorkflowGuidance, getMarketWorkflowGuidance, getWorkflowStepStates } from '../../utils/workflowGuidance'
import { EntryGeometryPanel } from '../entry/EntryGeometryPanel'
import { StepLabel } from '../methodology/StepLabel'
import { JargonTerm } from '../shared/JargonTerm'
import { SignalDrawer } from '../shared/SignalDrawer'
import { SetupCard } from '../setup/SetupCard'

const toneClasses = {
  green: 'text-signal-green',
  yellow: 'text-signal-yellow',
  red: 'text-signal-red',
} as const

export function SignalSection() {
  const coin = useStore((s) => s.selectedCoin)
  const { signals } = useSignals(coin)
  const decision = useEntryDecision(coin)
  const { outputs, riskStatus } = usePositionRisk()
  const composition = useSuggestedPosition(coin)
  const [, step2] = getWorkflowStepStates(signals, decision, outputs, riskStatus, composition)
  const [drawerKind, setDrawerKind] = useState<SignalSeriesKind | null>(null)

  if (!signals) {
    return (
      <section className="panel-shell workflow-card workflow-card--yellow workflow-card--wait workflow-card--locked">
        <StepLabel step={2} tone="yellow" state="wait" access="locked" />
        <div className="panel-kicker">Step 2</div>
        <h2 className="panel-title">Is there an entry right now?</h2>
        <div className="loading-block h-24" />
      </section>
    )
  }

  const marketGuidance = getMarketWorkflowGuidance(signals)
  const guidance = getEntryWorkflowGuidance(signals, decision, marketGuidance)

  return (
    <section
      className={[
        'panel-shell',
        'workflow-card',
        `workflow-card--${step2.tone}`,
        `workflow-card--${step2.state}`,
        `workflow-card--${step2.access}`,
        step2.isCurrentFocus ? 'workflow-card--pulse' : '',
      ].join(' ')}
    >
      <StepLabel
        step={2}
        tone={step2.tone}
        state={step2.state}
        access={step2.access}
        isCurrentFocus={step2.isCurrentFocus}
      />
      <div className="panel-header">
        <div>
          <div className="panel-kicker">Step 2</div>
          <h2 className="panel-title">Is there an entry right now?</h2>
        </div>
        <div className="flex items-center gap-2">
          {guidance.directionLabel !== 'NONE' && (
            <span className={`setup-card__direction setup-card__direction--${guidance.directionLabel === 'LONG' ? 'green' : 'red'}`}>
              {guidance.directionLabel}
            </span>
          )}
          <span className={`status-pill status-pill--${guidance.tone}`}>{guidance.label}</span>
        </div>
      </div>

      <p className="panel-copy">{guidance.summary}</p>

      <div className="step2-parallel-shell">
        <div className="step2-parallel-shell__setup">
          <SetupCard coin={coin} />
        </div>
        <div className="step2-parallel-shell__kpis">
          <div className="step2-kpi-shell">
            <div className="step2-kpi-row step2-kpi-row--single">
              {signals.composite.signalBreakdown.map((signal) => (
                <div key={signal.name} className="step2-kpi-card">
                  <div className="step2-kpi-card__label">{signal.name}</div>
                  <div
                    className={`step2-kpi-card__value ${
                      signal.agrees
                        ? 'text-signal-green'
                        : signal.direction === 'neutral'
                          ? 'text-text-muted'
                          : 'text-signal-red'
                    }`}
                  >
                    {signal.direction.toUpperCase()}
                  </div>
                  <div className="step2-kpi-card__hint">
                    {signal.agrees
                      ? 'Aligned'
                      : signal.direction === 'neutral'
                        ? 'Inactive'
                        : 'Against'}
                  </div>
                </div>
              ))}

              <Metric
                label={<JargonTerm term="Z-Score">Price stretch</JargonTerm>}
                value={`${signals.zScore.value.toFixed(2)}\u03C3`}
                tone={signals.zScore.color}
                onActivate={() => setDrawerKind('zScore')}
                compact
              />
              <EntryGeometryPanel embedded mode="compactKpi" />
            </div>
          </div>
        </div>
      </div>

      <SignalDrawer coin={coin} signalKind={drawerKind} onClose={() => setDrawerKind(null)} />
    </section>
  )
}

interface MetricProps {
  label: React.ReactNode
  value: string
  tone: 'green' | 'yellow' | 'red'
  onActivate?: () => void
  compact?: boolean
}

function Metric({ label, value, tone, onActivate, compact = false }: MetricProps) {
  const baseClass = compact ? 'step2-kpi-card' : 'stat-card'
  const clickableClass = compact ? 'step2-kpi-card--clickable' : 'stat-card--clickable'
  const interactiveProps = onActivate
    ? {
        className: `${baseClass} ${clickableClass}`,
        role: 'button' as const,
        tabIndex: 0,
        onClick: onActivate,
        onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onActivate()
          }
        },
      }
    : {
        className: baseClass,
      }

  return (
    <div {...interactiveProps}>
      <div className={compact ? 'step2-kpi-card__label' : 'stat-label'}>{label}</div>
      <div className={`${compact ? 'step2-kpi-card__value' : 'stat-value'} ${toneClasses[tone]}`}>{value}</div>
      {compact && <div className="step2-kpi-card__hint">Tap for chart</div>}
    </div>
  )
}

import { useState } from 'react'
import { useEntryDecision } from '../../hooks/useEntryDecision'
import { useSignals } from '../../hooks/useSignals'
import { useStore } from '../../store'
import type { SignalSeriesKind } from '../../utils/provenance'
import { getEntryWorkflowGuidance, getMarketWorkflowGuidance } from '../../utils/workflowGuidance'
import { EntryGeometryPanel } from '../entry/EntryGeometryPanel'
import { StepLabel } from '../methodology/StepLabel'
import { ExpandableSection } from '../shared/ExpandableSection'
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
  const [drawerKind, setDrawerKind] = useState<SignalSeriesKind | null>(null)

  if (!signals) {
    return (
      <section className="panel-shell">
        <StepLabel step={2} />
        <div className="panel-kicker">Step 2</div>
        <h2 className="panel-title">Is there an entry right now?</h2>
        <div className="loading-block h-24" />
      </section>
    )
  }

  const marketGuidance = getMarketWorkflowGuidance(signals)
  const guidance = getEntryWorkflowGuidance(signals, decision, marketGuidance)

  return (
    <section className="panel-shell">
      <StepLabel step={2} />
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

      <SetupCard coin={coin} />

      <ExpandableSection sectionId="step2-advanced" title="advanced signal details">
        <div className="breakdown-grid">
          {signals.composite.signalBreakdown.map((signal) => (
            <div key={signal.name} className="stat-card">
              <div className="stat-label">{signal.name}</div>
              <div
                className={`stat-value ${
                  signal.agrees
                    ? 'text-signal-green'
                    : signal.direction === 'neutral'
                      ? 'text-text-muted'
                      : 'text-signal-red'
                }`}
              >
                {signal.direction.toUpperCase()}
              </div>
              <div className="text-sm text-text-secondary">
                {signal.agrees
                  ? 'Aligned with the setup'
                  : signal.direction === 'neutral'
                    ? 'Not active'
                    : 'Working against the setup'}
              </div>
            </div>
          ))}
        </div>

        <div>
          <Metric
            label={<JargonTerm term="Z-Score">Price stretch</JargonTerm>}
            value={`${signals.zScore.value.toFixed(2)}\u03C3`}
            tone={signals.zScore.color}
            onActivate={() => setDrawerKind('zScore')}
          />
        </div>

        <EntryGeometryPanel embedded />
      </ExpandableSection>

      <SignalDrawer coin={coin} signalKind={drawerKind} onClose={() => setDrawerKind(null)} />
    </section>
  )
}

interface MetricProps {
  label: React.ReactNode
  value: string
  tone: 'green' | 'yellow' | 'red'
  onActivate?: () => void
}

function Metric({ label, value, tone, onActivate }: MetricProps) {
  const interactiveProps = onActivate
    ? {
        className: 'stat-card stat-card--clickable',
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
        className: 'stat-card',
      }

  return (
    <div {...interactiveProps}>
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${toneClasses[tone]}`}>{value}</div>
    </div>
  )
}

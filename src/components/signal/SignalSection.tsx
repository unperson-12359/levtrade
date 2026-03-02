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
        <span className={`status-pill status-pill--${guidance.tone}`}>{guidance.label}</span>
      </div>

      <p className="panel-copy">{guidance.summary}</p>

      <div className="workflow-summary-grid">
        <article className="workflow-summary-card">
          <div className="workflow-summary-card__kicker">Direction</div>
          <div className={`workflow-summary-card__value ${toneClasses[guidance.tone]}`}>
            {guidance.directionLabel}
          </div>
          <p className="workflow-summary-card__copy">This is the side the dashboard would favor if a trade exists.</p>
        </article>
        <article className="workflow-summary-card">
          <div className="workflow-summary-card__kicker">What to do now</div>
          <p className="workflow-summary-card__copy">{guidance.action}</p>
        </article>
        <article className="workflow-summary-card">
          <div className="workflow-summary-card__kicker">What to wait for</div>
          <p className="workflow-summary-card__copy">{guidance.waitFor}</p>
        </article>
      </div>

      {guidance.reasons.length > 0 && (
        <div className="decision-hero__reasons">
          <div className="workflow-summary-card__kicker">Why the dashboard says this</div>
          <div className="decision-strip__chips">
            {guidance.reasons.slice(0, 4).map((reason) => (
              <span key={reason} className="warning-chip warning-chip--blue">
                {reason}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className={`action-guidance action-guidance--${guidance.tone}`}>{guidance.action}</div>

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

        <div className="stat-grid">
          <Metric
            label={<JargonTerm term="Z-Score">Price stretch</JargonTerm>}
            value={`${signals.zScore.value.toFixed(2)}\u03C3`}
            tone={signals.zScore.color}
            onActivate={() => setDrawerKind('zScore')}
          />
          <Metric
            label={<JargonTerm term="Funding Rate">Crowd positioning</JargonTerm>}
            value={`${signals.funding.zScore.toFixed(2)}\u03C3`}
            tone={signals.funding.color}
            onActivate={() => setDrawerKind('fundingRate')}
          />
          <Metric
            label={<JargonTerm term="OI Delta">Money flow</JargonTerm>}
            value={signals.oiDelta.confirmation ? 'CONFIRMED' : 'DIVERGING'}
            tone={signals.oiDelta.color}
          />
          <Metric
            label={<JargonTerm term="Composite">Overall agreement</JargonTerm>}
            value={signals.composite.value.toFixed(2)}
            tone={signals.composite.color}
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

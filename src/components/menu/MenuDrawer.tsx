import { useState } from 'react'
import { useEntryDecision } from '../../hooks/useEntryDecision'
import { usePositionRisk } from '../../hooks/usePositionRisk'
import { useSignals } from '../../hooks/useSignals'
import { useStore } from '../../store'
import { timeAgo } from '../../utils/format'
import { getMethodologySteps } from '../../utils/workflowGuidance'

export function MenuDrawer() {
  const open = useStore((s) => s.expandedSections['menu'] ?? false)
  const toggle = useStore((s) => s.toggleSection)
  const close = () => {
    if (open) toggle('menu')
  }

  const connectionStatus = useStore((s) => s.connectionStatus)
  const lastUpdate = useStore((s) => s.lastUpdate)

  const coin = useStore((s) => s.selectedCoin)
  const { signals } = useSignals(coin)
  const decision = useEntryDecision(coin)
  const { outputs, riskStatus } = usePositionRisk()
  const steps = getMethodologySteps(signals, decision, outputs, riskStatus)

  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  const connectionLabel =
    connectionStatus === 'connected'
      ? 'Connected'
      : connectionStatus === 'connecting'
        ? 'Connecting...'
        : connectionStatus === 'disconnected'
          ? 'Disconnected'
          : 'Error'
  const connectionTone =
    connectionStatus === 'connected'
      ? 'green'
      : connectionStatus === 'connecting'
        ? 'yellow'
        : 'red'

  return (
    <>
      {open && <div className="menu-drawer__backdrop" onClick={close} />}
      <nav className={`menu-drawer ${open ? 'menu-drawer--open' : ''}`}>
        <div className="menu-drawer__header">
          <span className="menu-drawer__title">LevTrade</span>
          <button type="button" onClick={close} className="signal-drawer__close" aria-label="Close menu">
            X
          </button>
        </div>

        <div className="menu-drawer__section">
          <div className="menu-drawer__status-row">
            <span className={`menu-drawer__dot menu-drawer__dot--${connectionTone}`} />
            <span>{connectionLabel}</span>
            {lastUpdate && <span className="menu-drawer__muted">| {timeAgo(lastUpdate)}</span>}
          </div>
        </div>

        <div className="menu-drawer__section">
          <button
            type="button"
            className="menu-drawer__guide-link"
            onClick={() => {
              toggle('analytics')
              close()
            }}
          >
            Analytics <span className="menu-drawer__muted">-&gt;</span>
          </button>
          <button
            type="button"
            className="menu-drawer__guide-link"
            onClick={() => {
              toggle('how-it-works')
              close()
            }}
          >
            How LevTrade Works <span className="menu-drawer__muted">-&gt;</span>
          </button>
        </div>

        <div className="menu-drawer__section">
          <div className="menu-drawer__section-title">Workflow</div>
          {steps.map((step) => {
            const isOpen = expandedStep === step.step
            return (
              <div key={step.step}>
                <button
                  type="button"
                  className="menu-drawer__workflow-row"
                  onClick={() => setExpandedStep(isOpen ? null : step.step)}
                >
                  <span className={`menu-drawer__dot menu-drawer__dot--${step.tone}`} />
                  <span className="menu-drawer__workflow-name">{step.title}</span>
                  <span className={`menu-drawer__workflow-label menu-drawer__workflow-label--${step.tone}`}>
                    {step.label}
                  </span>
                  <span
                    className={`menu-drawer__workflow-chevron ${isOpen ? 'menu-drawer__workflow-chevron--open' : ''}`}
                  >
                    &gt;
                  </span>
                </button>
                {isOpen && (
                  <div className="menu-drawer__workflow-expand">
                    <div className="menu-drawer__workflow-question">{step.question}</div>
                    <div className="menu-drawer__workflow-detail">{step.detail}</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="menu-drawer__section">
          <div className="menu-drawer__section-title">
            Storage
            <span className="status-pill status-pill--green menu-drawer__inline-pill">SERVER HISTORY</span>
          </div>
          <div className="menu-drawer__muted">
            Historical setups and resolved outcomes can hydrate from the Oracle-backed collector. Tracker state and
            risk defaults still stay local to this browser.
          </div>
          <div className="menu-drawer__muted">
            Browser storage still keeps your local state after refresh, while server history keeps growing even when
            this tab is closed.
          </div>
        </div>
      </nav>
    </>
  )
}

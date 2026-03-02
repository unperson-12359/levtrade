import { useState } from 'react'
import { useEntryDecision } from '../../hooks/useEntryDecision'
import { usePositionRisk } from '../../hooks/usePositionRisk'
import { useSignals } from '../../hooks/useSignals'
import { useStore } from '../../store'
import type { SyncStatus } from '../../types'
import { timeAgo } from '../../utils/format'
import { getMethodologySteps } from '../../utils/workflowGuidance'

interface MenuDrawerProps {
  onSyncNow: () => Promise<void>
}

export function MenuDrawer({ onSyncNow }: MenuDrawerProps) {
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

  const syncStatus = useStore((s) => s.syncStatus)
  const syncError = useStore((s) => s.syncError)
  const lastCloudSyncAt = useStore((s) => s.lastCloudSyncAt)
  const syncLabel = syncStatusLabel(syncStatus)
  const syncTone = syncStatusTone(syncStatus)

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
            Backend Sync
            <span className={`status-pill status-pill--${syncTone} menu-drawer__inline-pill`}>{syncLabel}</span>
          </div>
          <div className="menu-drawer__muted">
            App state is shared live through the backend. Local storage is only a startup and offline cache.
          </div>
          <div className="menu-drawer__muted">
            Last sync: {lastCloudSyncAt ? timeAgo(lastCloudSyncAt) : 'Not yet'}
          </div>
          {(syncStatus === 'error' || syncStatus === 'offline') && (
            <div className="menu-drawer__sync-buttons">
              <button
                type="button"
                onClick={() => {
                  void onSyncNow()
                }}
                className="setup-history__filter"
              >
                Retry sync
              </button>
            </div>
          )}
          {syncError && <div className="action-guidance action-guidance--red">{syncError}</div>}
        </div>
      </nav>
    </>
  )
}

function syncStatusTone(status: SyncStatus): 'green' | 'yellow' | 'red' {
  if (status === 'synced') return 'green'
  if (status === 'error' || status === 'offline') return 'red'
  return 'yellow'
}

function syncStatusLabel(status: SyncStatus): string {
  switch (status) {
    case 'idle':
      return 'Starting'
    case 'syncing':
      return 'Syncing'
    case 'synced':
      return 'Live'
    case 'error':
      return 'Error'
    case 'offline':
      return 'Offline'
    default:
      return 'Starting'
  }
}

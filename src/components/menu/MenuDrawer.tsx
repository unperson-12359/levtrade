import { useEffect, useState } from 'react'
import { useEntryDecision } from '../../hooks/useEntryDecision'
import { usePositionRisk } from '../../hooks/usePositionRisk'
import { useSignals } from '../../hooks/useSignals'
import { useStore } from '../../store'
import { normalizeSyncScope } from '../../sync/policy'
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

  const cloudSyncEnabled = useStore((s) => s.cloudSyncEnabled)
  const cloudSyncScope = useStore((s) => s.cloudSyncScope)
  const cloudSyncSecret = useStore((s) => s.cloudSyncSecret)
  const syncStatus = useStore((s) => s.syncStatus)
  const syncError = useStore((s) => s.syncError)
  const configureCloudSync = useStore((s) => s.configureCloudSync)
  const disableCloudSync = useStore((s) => s.disableCloudSync)
  const [scopeInput, setScopeInput] = useState(cloudSyncScope)
  const [secretInput, setSecretInput] = useState(cloudSyncSecret)

  useEffect(() => {
    setScopeInput(cloudSyncScope)
  }, [cloudSyncScope])

  useEffect(() => {
    setSecretInput(cloudSyncSecret)
  }, [cloudSyncSecret])

  const syncLabel = cloudSyncEnabled ? syncStatusLabel(syncStatus) : 'Off'
  const syncTone = cloudSyncEnabled ? syncStatusTone(syncStatus) : 'yellow'

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
            Cloud Sync
            <span className={`status-pill status-pill--${syncTone} menu-drawer__inline-pill`}>{syncLabel}</span>
          </div>
          <div className="menu-drawer__sync-form">
            <input
              type="text"
              value={scopeInput}
              onChange={(e) => setScopeInput(normalizeSyncScope(e.target.value))}
              placeholder="Workspace id"
              className="trust-panel__input"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <input
              type="password"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              placeholder="Workspace secret"
              className="trust-panel__input"
            />
            <div className="menu-drawer__sync-buttons">
              <button
                type="button"
                onClick={() => configureCloudSync(scopeInput, secretInput)}
                className="setup-history__filter"
              >
                {cloudSyncEnabled ? 'Update' : 'Enable'}
              </button>
              <button
                type="button"
                onClick={() => {
                  void onSyncNow()
                }}
                className="setup-history__filter"
                disabled={!cloudSyncEnabled}
              >
                Sync now
              </button>
              <button
                type="button"
                onClick={disableCloudSync}
                className="setup-history__filter"
                disabled={!cloudSyncEnabled && !cloudSyncScope}
              >
                Disable
              </button>
            </div>
          </div>
          <div className="menu-drawer__muted">Workspace id persists locally. Secret is session-only.</div>
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
      return 'Ready'
    case 'syncing':
      return 'Syncing'
    case 'synced':
      return 'Synced'
    case 'error':
      return 'Error'
    case 'offline':
      return 'Offline'
    default:
      return 'Locked'
  }
}

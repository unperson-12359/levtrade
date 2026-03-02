import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store'
import type { SyncStatus } from '../../types'

interface SettingsBarProps {
  onSyncNow: () => Promise<void>
}

export function SettingsBar({ onSyncNow }: SettingsBarProps) {
  const expanded = useStore((s) => s.expandedSections['settings'] ?? false)
  const toggle = useStore((s) => s.toggleSection)
  const cloudSyncEnabled = useStore((s) => s.cloudSyncEnabled)
  const cloudSyncSecret = useStore((s) => s.cloudSyncSecret)
  const syncStatus = useStore((s) => s.syncStatus)
  const syncError = useStore((s) => s.syncError)
  const configureCloudSync = useStore((s) => s.configureCloudSync)
  const disableCloudSync = useStore((s) => s.disableCloudSync)

  const [secretInput, setSecretInput] = useState(cloudSyncSecret)
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | undefined>(undefined)

  useEffect(() => {
    setSecretInput(cloudSyncSecret)
  }, [cloudSyncSecret])

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight)
    }
  }, [expanded])

  const syncLabel = cloudSyncEnabled ? syncStatusLabel(syncStatus) : 'Cloud sync off'
  const syncTone = cloudSyncEnabled ? syncStatusTone(syncStatus) : 'yellow'

  return (
    <div className="settings-bar">
      <button
        type="button"
        onClick={() => toggle('settings')}
        className="settings-bar__header"
      >
        <div className="settings-bar__left">
          <svg className="settings-bar__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="methodology-banner__title">Settings</span>
        </div>
        <div className="settings-bar__right">
          <span className={`status-pill status-pill--${syncTone}`}>{syncLabel}</span>
          <span className={`methodology-banner__chevron ${expanded ? 'methodology-banner__chevron--open' : ''}`}>
            ▼
          </span>
        </div>
      </button>

      <div
        ref={contentRef}
        className="settings-bar__content-wrap"
        style={{
          maxHeight: expanded ? (height ?? 400) : 0,
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="settings-bar__content">
          <div className="trust-panel__sync-head">
            <div>
              <div className="stat-label">Shared cloud workspace</div>
              <div className="trust-panel__sync-copy">
                Use the same passphrase on each device to sync setup history, tracker history, and risk defaults.
              </div>
            </div>
          </div>

          <div className="trust-panel__sync-form">
            <input
              type="password"
              value={secretInput}
              onChange={(event) => setSecretInput(event.target.value)}
              placeholder="Enter shared sync passphrase"
              className="trust-panel__input"
            />
            <button
              type="button"
              onClick={() => configureCloudSync(secretInput)}
              className="setup-history__filter"
            >
              {cloudSyncEnabled ? 'Update passphrase' : 'Enable sync'}
            </button>
            <button
              type="button"
              onClick={() => { void onSyncNow() }}
              className="setup-history__filter"
              disabled={!cloudSyncEnabled}
            >
              Force sync now
            </button>
            <button
              type="button"
              onClick={disableCloudSync}
              className="setup-history__filter"
              disabled={!cloudSyncEnabled}
            >
              Disable on this device
            </button>
          </div>

          {syncError && <div className="action-guidance action-guidance--red">{syncError}</div>}
        </div>
      </div>
    </div>
  )
}

function syncStatusTone(status: SyncStatus): 'green' | 'yellow' | 'red' {
  if (status === 'synced') return 'green'
  if (status === 'error' || status === 'offline') return 'red'
  return 'yellow'
}

function syncStatusLabel(status: SyncStatus): string {
  switch (status) {
    case 'idle': return 'Ready to sync'
    case 'syncing': return 'Syncing now'
    case 'synced': return 'Cloud synced'
    case 'error': return 'Sync error'
    case 'offline': return 'Offline'
    default: return 'Locked'
  }
}

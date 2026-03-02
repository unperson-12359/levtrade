import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../store'
import type { SyncStatus } from '../../types'

const STORAGE_KEY = 'levtrade-storage'

interface TrustPanelProps {
  onSyncNow: () => Promise<void>
}

export function TrustPanel({ onSyncNow }: TrustPanelProps) {
  const trackedSetups = useStore((s) => s.trackedSetups)
  const exportCsv = useStore((s) => s.exportSetupsCsv)
  const exportJson = useStore((s) => s.exportSetupsJson)
  const importJson = useStore((s) => s.importSetupsJson)
  const clearSetupHistory = useStore((s) => s.clearSetupHistory)
  const clearTrackerHistory = useStore((s) => s.clearTrackerHistory)
  const cloudSyncEnabled = useStore((s) => s.cloudSyncEnabled)
  const cloudSyncSecret = useStore((s) => s.cloudSyncSecret)
  const syncStatus = useStore((s) => s.syncStatus)
  const syncError = useStore((s) => s.syncError)
  const lastCloudSyncAt = useStore((s) => s.lastCloudSyncAt)
  const configureCloudSync = useStore((s) => s.configureCloudSync)
  const disableCloudSync = useStore((s) => s.disableCloudSync)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [secretInput, setSecretInput] = useState(cloudSyncSecret)

  useEffect(() => {
    setSecretInput(cloudSyncSecret)
  }, [cloudSyncSecret])

  const summary = useMemo(() => {
    const outcomes = trackedSetups.flatMap((tracked) => Object.values(tracked.outcomes))
    const pendingCount = outcomes.filter((outcome) => outcome.result === 'pending').length
    const unresolvableCount = outcomes.filter((outcome) => outcome.result === 'unresolvable').length
    const oldest = trackedSetups.length > 0 ? trackedSetups[0]!.setup.generatedAt : null
    const newest = trackedSetups.length > 0 ? trackedSetups[trackedSetups.length - 1]!.setup.generatedAt : null

    return {
      pendingCount,
      unresolvableCount,
      oldest,
      newest,
    }
  }, [trackedSetups])

  const syncLabel = cloudSyncEnabled ? syncStatusLabel(syncStatus) : 'Cloud sync off'
  const syncTone = cloudSyncEnabled ? syncStatusTone(syncStatus) : 'yellow'

  return (
    <section className="panel-shell trust-panel">
      <div className="panel-header">
        <div>
          <div className="panel-kicker">Trust and storage</div>
          <h3 className="panel-title">What is actually being saved and scored</h3>
        </div>
        <span className={`status-pill status-pill--${syncTone}`}>{syncLabel}</span>
      </div>

      <p className="panel-copy">
        {cloudSyncEnabled
          ? 'Trading history core now syncs across devices through the shared cloud workspace. Local storage still acts as a cache, and UI state like selected asset and expanded sections remains browser-local.'
          : 'Setup and tracker history are still local to this browser until cloud sync is enabled. The app will keep working locally either way, but cross-device history needs the shared sync passphrase.'}
      </p>

      <div className="stat-grid trust-panel__stats">
        <Stat label="Storage key" value={STORAGE_KEY} tone="yellow" />
        <Stat label="Cloud sync" value={syncLabel} tone={syncTone} />
        <Stat label="Tracked setups" value={String(trackedSetups.length)} tone="yellow" />
        <Stat label="Pending outcomes" value={String(summary.pendingCount)} tone="yellow" />
        <Stat label="Unresolvable" value={String(summary.unresolvableCount)} tone={summary.unresolvableCount > 0 ? 'red' : 'green'} />
        <Stat label="Oldest setup" value={summary.oldest ? formatTimestamp(summary.oldest) : 'N/A'} tone="yellow" />
        <Stat label="Newest setup" value={summary.newest ? formatTimestamp(summary.newest) : 'N/A'} tone="yellow" />
        <Stat label="Last cloud sync" value={lastCloudSyncAt ? formatTimestamp(lastCloudSyncAt) : 'Never'} tone="yellow" />
        <Stat label="Retention" value="90 days" tone="green" />
        <Stat label="Sync scope" value="History + risk defaults" tone="green" />
        <Stat label="Resolution basis" value="4h / 24h / 72h from 1h candles" tone="yellow" />
      </div>

      <div className="trust-panel__sync-box">
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
            onClick={() => {
              void onSyncNow()
            }}
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

        <p className="trust-panel__sync-copy">
          History survives refreshes locally, but without cloud sync it does not follow you to another browser or
          device. Even with cloud sync on, this is still a single shared workspace protected by one passphrase.
        </p>

        {syncError && <div className="action-guidance action-guidance--red">{syncError}</div>}
      </div>

      <div className="setup-history__filters">
        <button type="button" onClick={exportCsv} className="setup-history__filter">
          Export CSV
        </button>
        <button type="button" onClick={exportJson} className="setup-history__filter">
          Export JSON
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="setup-history__filter"
        >
          Import JSON
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Clear all locally saved setup and tracker history for this browser?')) {
              clearSetupHistory()
              clearTrackerHistory()
            }
          }}
          className="setup-history__filter"
        >
          Clear history
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0]
          if (file) {
            await importJson(file)
          }
          event.currentTarget.value = ''
        }}
      />
    </section>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'green' | 'yellow' | 'red' }) {
  const toneClasses = {
    green: 'text-signal-green',
    yellow: 'text-signal-yellow',
    red: 'text-signal-red',
  } as const

  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${toneClasses[tone]}`}>{value}</div>
    </div>
  )
}

function syncStatusTone(status: SyncStatus): 'green' | 'yellow' | 'red' {
  if (status === 'synced') {
    return 'green'
  }
  if (status === 'error' || status === 'offline') {
    return 'red'
  }
  return 'yellow'
}

function syncStatusLabel(status: SyncStatus): string {
  switch (status) {
    case 'idle':
      return 'Ready to sync'
    case 'syncing':
      return 'Syncing now'
    case 'synced':
      return 'Cloud synced'
    case 'error':
      return 'Sync error'
    case 'offline':
      return 'Offline'
    default:
      return 'Locked'
  }
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

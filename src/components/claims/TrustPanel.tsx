import { useRef } from 'react'
import { useStore } from '../../store'
import type { SyncStatus } from '../../types'

const STORAGE_KEY = 'levtrade-storage'

export function TrustPanel() {
  const exportCsv = useStore((s) => s.exportSetupsCsv)
  const exportJson = useStore((s) => s.exportSetupsJson)
  const importJson = useStore((s) => s.importSetupsJson)
  const clearSetupHistory = useStore((s) => s.clearSetupHistory)
  const clearTrackerHistory = useStore((s) => s.clearTrackerHistory)
  const cloudSyncEnabled = useStore((s) => s.cloudSyncEnabled)
  const syncStatus = useStore((s) => s.syncStatus)
  const lastCloudSyncAt = useStore((s) => s.lastCloudSyncAt)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
          ? 'Syncing across devices via cloud. Local storage acts as cache.'
          : 'History is local to this browser. Enable cloud sync for cross-device sharing.'}
      </p>

      <div className="stat-grid trust-panel__stats">
        <Stat label="Storage key" value={STORAGE_KEY} tone="yellow" />
        <Stat label="Cloud sync" value={syncLabel} tone={syncTone} />
        <Stat label="Last cloud sync" value={lastCloudSyncAt ? formatTimestamp(lastCloudSyncAt) : 'Never'} tone="yellow" />
        <Stat label="Retention" value="90 days" tone="green" />
        <Stat label="Sync scope" value="History + risk defaults" tone="green" />
        <Stat label="Resolution basis" value="4h / 24h / 72h from 1h candles" tone="yellow" />
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

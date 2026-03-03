import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../store'
import { fetchCollectorHeartbeat } from '../../services/api'
import { timeAgo } from '../../utils/format'
import type { CollectorHeartbeat } from '../../types/collector'

const STORAGE_KEY = 'levtrade-storage'

export function TrustPanel() {
  const exportCsv = useStore((s) => s.exportSetupsCsv)
  const exportJson = useStore((s) => s.exportSetupsJson)
  const importJson = useStore((s) => s.importSetupsJson)
  const clearSetupHistory = useStore((s) => s.clearSetupHistory)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [collectorHeartbeat, setCollectorHeartbeat] = useState<(CollectorHeartbeat & { status: string }) | null>(null)

  useEffect(() => {
    let active = true

    void fetchCollectorHeartbeat().then((heartbeat) => {
      if (active) {
        setCollectorHeartbeat(heartbeat)
      }
    })

    return () => {
      active = false
    }
  }, [])

  const collectorStatus = useMemo<{
    label: string
    tone: 'green' | 'yellow' | 'red'
    lastRun: string
  }>(() => {
    if (!collectorHeartbeat) {
      return { label: 'Unavailable', tone: 'yellow', lastRun: 'No server heartbeat' }
    }

    if (collectorHeartbeat.status === 'live') {
      return {
        label: 'Live',
        tone: 'green',
        lastRun: collectorHeartbeat.lastRunAt ? timeAgo(collectorHeartbeat.lastRunAt) : 'No recent run',
      }
    }

    if (collectorHeartbeat.status === 'error') {
      return {
        label: 'Error',
        tone: 'red',
        lastRun: collectorHeartbeat.lastRunAt ? timeAgo(collectorHeartbeat.lastRunAt) : 'No recent run',
      }
    }

    return {
      label: 'Stale',
      tone: 'yellow',
      lastRun: collectorHeartbeat.lastRunAt ? timeAgo(collectorHeartbeat.lastRunAt) : 'No recent run',
    }
  }, [collectorHeartbeat])

  return (
    <section className="panel-shell trust-panel">
      <div className="panel-header">
        <div>
          <div className="panel-kicker">Trust and storage</div>
          <h3 className="panel-title">What is actually being saved and scored</h3>
        </div>
        <span className={`status-pill status-pill--${collectorStatus.tone}`}>SERVER HISTORY</span>
      </div>

      <p className="panel-copy">
        Canonical historical setups, signal accuracy, and resolved outcomes are collected by the server and should match
        across devices. When server setup history is available, history and performance use the server dataset only so
        counts stay aligned on desktop and mobile. If a canonical analytics endpoint is unavailable, the dashboard can
        temporarily fall back to browser-local history on this device. Risk defaults, UI preferences, and imported
        setup records persist locally in this browser.
      </p>

      <div className="stat-grid trust-panel__stats">
        <Stat label="Storage key" value={STORAGE_KEY} tone="yellow" />
        <Stat label="History source" value="Oracle collector" tone="green" />
        <Stat label="Collector status" value={collectorStatus.label} tone={collectorStatus.tone} />
        <Stat label="Last server run" value={collectorStatus.lastRun} tone={collectorStatus.tone} />
        <Stat label="Persistence" value="Supabase + browser cache" tone="green" />
        <Stat label="State model" value="Server canonical, local fallback only when needed" tone="green" />
        <Stat label="Retention" value="90 days" tone="green" />
        <Stat label="Saved scope" value="Server analytics + local imports + browser settings" tone="green" />
        <Stat label="Resolution basis" value="4h / 24h / 72h from 1h candles" tone="green" />
      </div>

      {collectorHeartbeat?.lastError && (
        <div className="panel-copy">
          Collector note: {collectorHeartbeat.lastError}
        </div>
      )}

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
            if (window.confirm('Clear imported setup history and browser-local setup cache for this browser?')) {
              clearSetupHistory()
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

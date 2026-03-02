import { useRef } from 'react'
import { useStore } from '../../store'

const STORAGE_KEY = 'levtrade-storage'

export function TrustPanel() {
  const exportCsv = useStore((s) => s.exportSetupsCsv)
  const exportJson = useStore((s) => s.exportSetupsJson)
  const importJson = useStore((s) => s.importSetupsJson)
  const clearSetupHistory = useStore((s) => s.clearSetupHistory)
  const clearTrackerHistory = useStore((s) => s.clearTrackerHistory)
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <section className="panel-shell trust-panel">
      <div className="panel-header">
        <div>
          <div className="panel-kicker">Trust and storage</div>
          <h3 className="panel-title">What is actually being saved and scored</h3>
        </div>
        <span className="status-pill status-pill--green">LOCAL ONLY</span>
      </div>

      <p className="panel-copy">
        This build stores state locally in this browser to avoid Vercel transfer limits. Setup history, tracker results,
        and risk defaults persist after refresh, but they are not shared through the backend.
      </p>

      <div className="stat-grid trust-panel__stats">
        <Stat label="Storage key" value={STORAGE_KEY} tone="yellow" />
        <Stat label="Storage mode" value="This browser only" tone="green" />
        <Stat label="Backend sync" value="Disabled" tone="green" />
        <Stat label="Persistence" value="Refresh-safe local storage" tone="green" />
        <Stat label="State model" value="Local-only app state" tone="green" />
        <Stat label="Retention" value="90 days" tone="green" />
        <Stat label="Saved scope" value="Setups + tracker + risk defaults" tone="green" />
        <Stat label="Resolution basis" value="4h / 24h / 72h from 1h candles" tone="green" />
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
            if (window.confirm('Clear all locally cached setup and tracker history for this browser?')) {
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

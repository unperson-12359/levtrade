import { useStore } from '../../store'
import type { AnalyticsTab } from '../../store/uiSlice'
import { AccuracyPanel } from '../tracker/AccuracyPanel'
import { SetupHistory } from '../setup/SetupHistory'
import { TrustPanel } from '../claims/TrustPanel'

const TABS: { id: AnalyticsTab; label: string }[] = [
  { id: 'accuracy', label: 'Accuracy' },
  { id: 'history', label: 'History' },
  { id: 'storage', label: 'Data & Storage' },
]

export function AnalyticsTabs() {
  const activeTab = useStore((s) => s.analyticsTab)
  const setTab = useStore((s) => s.setAnalyticsTab)

  return (
    <section className="panel-shell analytics-tabs">
      <div className="panel-header">
        <div>
          <div className="panel-kicker">Analytics</div>
          <h3 className="panel-title">Track performance and manage data</h3>
        </div>
      </div>

      <div className="analytics-tabs__bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTab(tab.id)}
            className={
              activeTab === tab.id
                ? 'analytics-tabs__tab analytics-tabs__tab--active'
                : 'analytics-tabs__tab'
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="analytics-tabs__content">
        {activeTab === 'accuracy' && <AccuracyPanel />}
        {activeTab === 'history' && <SetupHistory />}
        {activeTab === 'storage' && <TrustPanel />}
      </div>
    </section>
  )
}

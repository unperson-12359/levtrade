import { useDataManager } from '../../hooks/useDataManager'
import { useStore } from '../../store'
import { AccuracyPanel } from '../tracker/AccuracyPanel'
import { DecisionStrip } from '../decision/DecisionStrip'
import { EntryGeometryPanel } from '../entry/EntryGeometryPanel'
import { MarketRail } from '../market/MarketRail'
import { MethodologyBanner } from '../methodology/MethodologyBanner'
import { RiskSection } from '../risk/RiskSection'
import { SignalSection } from '../signal/SignalSection'
import { PriceChart } from '../chart/PriceChart'
import { TopBar } from '../topbar/TopBar'

export function DashboardLayout() {
  useDataManager()

  const errors = useStore((s) => s.errors)
  const clearErrors = useStore((s) => s.clearErrors)
  const coin = useStore((s) => s.selectedCoin)

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {errors.length > 0 && (
        <div className="border-b border-signal-red/20 bg-signal-red/10 px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
            <div className="text-base text-signal-red">
              {errors[errors.length - 1]}
              {errors.length > 1 && <span className="ml-2 text-signal-red/60">(+{errors.length - 1} more)</span>}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg border border-signal-red/30 bg-signal-red/10 px-3 py-1 text-sm font-medium text-signal-red transition-colors hover:bg-signal-red/20"
              >
                Retry
              </button>
              <button onClick={clearErrors} className="text-base text-signal-red/60 hover:text-signal-red">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <TopBar />
      <MethodologyBanner />

      <main className="dashboard-shell">
        <section className="workspace-stack dashboard-main">
          <DecisionStrip />
          <PriceChart coin={coin} />
        </section>

        <aside className="dashboard-risk">
          <RiskSection />
        </aside>

        <section className="workspace-stack dashboard-secondary">
          <div className="workspace-grid">
            <EntryGeometryPanel />
            <SignalSection />
          </div>
          <AccuracyPanel />
        </section>

        <aside className="dashboard-rail">
          <MarketRail />
        </aside>
      </main>
    </div>
  )
}

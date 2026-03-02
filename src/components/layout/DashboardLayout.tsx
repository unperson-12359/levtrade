import { useCloudSync } from '../../hooks/useCloudSync'
import { useDataManager } from '../../hooks/useDataManager'
import { useTrackDecisionSnapshot } from '../../hooks/useTrackDecisionSnapshot'
import { useStore } from '../../store'
import { PriceChart } from '../chart/PriceChart'
import { TrustPanel } from '../claims/TrustPanel'
import { AccuracyPanel } from '../tracker/AccuracyPanel'
import { DecisionHero } from '../decision/DecisionHero'
import { MarketRail } from '../market/MarketRail'
import { MethodologyBanner } from '../methodology/MethodologyBanner'
import { RiskSection } from '../risk/RiskSection'
import { SignalSection } from '../signal/SignalSection'
import { SetupHistory } from '../setup/SetupHistory'
import { TopBar } from '../topbar/TopBar'

export function DashboardLayout() {
  useDataManager()
  useTrackDecisionSnapshot()
  const { syncNow } = useCloudSync()

  const coin = useStore((s) => s.selectedCoin)
  const errors = useStore((s) => s.errors)
  const clearErrors = useStore((s) => s.clearErrors)
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
          <div className="panel-shell panel-shell--chart">
            <div className="panel-kicker">Price map</div>
            <p className="panel-copy signal-chart-block__copy">
              Keep price action, stretch, and key levels in view while you work through the setup checklist below.
            </p>
            <PriceChart coin={coin} embedded showHeader={false} />
          </div>
          <DecisionHero />
          <MarketRail />
          <SignalSection />
          <AccuracyPanel />
          <SetupHistory />
          <TrustPanel onSyncNow={syncNow} />
        </section>

        <aside className="dashboard-risk">
          <RiskSection />
        </aside>
      </main>
    </div>
  )
}

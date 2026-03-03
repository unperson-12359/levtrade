import { lazy, Suspense } from 'react'
import { useDataManager } from '../../hooks/useDataManager'
import { useStore } from '../../store'
import { INTERVALS } from '../../config/intervals'
import { PriceChart } from '../chart/PriceChart'
import { DecisionHero } from '../decision/DecisionHero'
import { MarketRail } from '../market/MarketRail'
import { MenuDrawer } from '../menu/MenuDrawer'
import { RiskSection } from '../risk/RiskSection'
import { SignalSection } from '../signal/SignalSection'
import { TopBar } from '../topbar/TopBar'
import { LiveSetupsBanner } from '../predictions/HotPredictionsBanner'

const AnalyticsPage = lazy(() => import('../analytics/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })))
const HowItWorks = lazy(() => import('../guide/HowItWorks').then((m) => ({ default: m.HowItWorks })))

export function DashboardLayout() {
  useDataManager()

  const coin = useStore((s) => s.selectedCoin)
  const selectedInterval = useStore((s) => s.selectedInterval)
  const setInterval = useStore((s) => s.setInterval)
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
      <MenuDrawer />
      <Suspense fallback={null}>
        <HowItWorks />
      </Suspense>
      <Suspense fallback={null}>
        <AnalyticsPage />
      </Suspense>

      <LiveSetupsBanner />

      <main className="dashboard-shell">
        <section className="workspace-stack dashboard-main">
          <div className="panel-shell panel-shell--chart">
            <div className="chart-header-row">
              <div className="panel-kicker">Price map</div>
              <div className="topbar-intervals">
                {INTERVALS.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setInterval(tf)}
                    className={`topbar-interval-chip ${selectedInterval === tf ? 'topbar-interval-chip--active' : ''}`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            <PriceChart coin={coin} embedded showHeader={false} />
          </div>
          <DecisionHero />
          <div className="steps-row">
            <MarketRail />
            <SignalSection />
          </div>
        </section>

        <aside className="dashboard-risk">
          <RiskSection />
        </aside>
      </main>
    </div>
  )
}

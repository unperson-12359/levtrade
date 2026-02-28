import { useDataManager } from '../../hooks/useDataManager'
import { TopBar } from '../topbar/TopBar'
import { RegimeSection } from '../regime/RegimeSection'
import { SignalSection } from '../signal/SignalSection'
import { RiskSection } from '../risk/RiskSection'
import { useStore } from '../../store'

export function DashboardLayout() {
  useDataManager()

  const errors = useStore((s) => s.errors)
  const clearErrors = useStore((s) => s.clearErrors)

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* Error Banner */}
      {errors.length > 0 && (
        <div className="bg-signal-red/10 border-b border-signal-red/20 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="text-sm text-signal-red">
              {errors[errors.length - 1]}
              {errors.length > 1 && (
                <span className="text-signal-red/60 ml-2">
                  (+{errors.length - 1} more)
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1 rounded-lg border border-signal-red/30 bg-signal-red/10 text-signal-red text-xs font-medium hover:bg-signal-red/20 transition-colors"
              >
                Retry
              </button>
              <button
                onClick={clearErrors}
                className="text-signal-red/60 hover:text-signal-red text-sm"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <TopBar />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-6">
        <RegimeSection />
        <SignalSection />
        <RiskSection />
      </main>
    </div>
  )
}

import { useState } from 'react'
import { useLiveSetups, type HeatTier } from '../../hooks/useHotPredictions'
import { formatPercent, timeAgo } from '../../utils/format'
import type { TrackedSetup } from '../../types/setup'
import { SignalDrawer } from '../shared/SignalDrawer'

const PROFIT_CLASSES: Record<HeatTier, string> = {
  warm: 'live-rail-item--warm',
  hot: 'live-rail-item--hot',
  'on-fire': 'live-rail-item--on-fire live-setup-card--on-fire',
}

const UNDERWATER_CLASS = 'live-rail-item--underwater'

const HEAT_LABELS: Record<HeatTier, string> = {
  warm: 'WARM',
  hot: 'HOT',
  'on-fire': 'ON FIRE',
}

export function LiveSetupsBanner() {
  const liveSetups = useLiveSetups()
  const [reviewSetup, setReviewSetup] = useState<TrackedSetup | null>(null)

  if (liveSetups.length === 0) return null

  const profitCount = liveSetups.filter((s) => s.status === 'profit').length
  const underwaterCount = liveSetups.length - profitCount

  return (
    <>
      <section className="live-rail-shell" aria-label="Open setups carousel">
        <div className="live-rail-inner">
          <div className="live-rail-header">
            <span className="live-rail-title">Open Setups</span>
            {profitCount > 0 && (
              <span className="live-rail-pill live-rail-pill--green">
                {profitCount} winning
              </span>
            )}
            {underwaterCount > 0 && (
              <span className="live-rail-pill live-rail-pill--red">
                {underwaterCount} underwater
              </span>
            )}
          </div>

          <div className="live-rail-track scrollbar-hide">
            {liveSetups.map((s) => {
              const isProfit = s.status === 'profit'
              const styleClass = isProfit ? PROFIT_CLASSES[s.heatTier] : UNDERWATER_CLASS
              const { coin, direction, generatedAt } =
                s.tracked.setup

              return (
                <button
                  key={s.tracked.id}
                  type="button"
                  onClick={() => setReviewSetup(s.tracked)}
                  className={`live-rail-item ${styleClass}`}
                >
                  <span className="live-rail-item__coin">{coin}</span>
                  <span
                    className={`live-rail-item__direction ${
                      direction === 'long'
                        ? 'live-rail-item__direction--long'
                        : 'live-rail-item__direction--short'
                    }`}
                  >
                    {direction === 'long' ? 'L' : 'S'}
                  </span>
                  <span className={`live-rail-item__pnl ${isProfit ? 'text-signal-green' : 'text-signal-red'}`}>
                    {formatPercent(s.unrealizedPct)}
                  </span>
                  <span
                    className={`live-rail-item__status ${
                      isProfit
                        ? s.heatTier === 'on-fire'
                          ? 'text-signal-green'
                          : s.heatTier === 'hot'
                            ? 'text-signal-green/70'
                            : 'text-text-muted'
                        : 'text-signal-red/80'
                    }`}
                  >
                    {isProfit ? HEAT_LABELS[s.heatTier] : 'UW'}
                  </span>
                  <span className="live-rail-item__age">{timeAgo(generatedAt)}</span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <SignalDrawer
        coin={reviewSetup?.setup.coin ?? 'BTC'}
        signalKind={reviewSetup ? 'setup' : null}
        trackedSetup={reviewSetup}
        onClose={() => setReviewSetup(null)}
      />
    </>
  )
}

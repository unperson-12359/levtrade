import { useState } from 'react'
import { useLiveSetups, type HeatTier } from '../../hooks/useHotPredictions'
import { formatPercent, formatPrice, timeAgo } from '../../utils/format'
import type { TrackedCoin } from '../../types/market'
import type { TrackedSetup } from '../../types/setup'
import { SignalDrawer } from '../shared/SignalDrawer'

const PROFIT_CLASSES: Record<HeatTier, string> = {
  warm: 'live-rail-card--warm',
  hot: 'live-rail-card--hot',
  'on-fire': 'live-rail-card--on-fire live-setup-card--on-fire',
}

const UNDERWATER_CLASS = 'live-rail-card--underwater'

const HEAT_LABELS: Record<HeatTier, string> = {
  warm: 'Warm',
  hot: 'Hot',
  'on-fire': 'On Fire',
}

const TIER_COLORS: Record<string, string> = {
  high: 'text-signal-green',
  medium: 'text-signal-yellow',
  low: 'text-text-muted',
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
              const { coin, direction, confidenceTier, entryPrice, stopPrice, targetPrice, generatedAt } =
                s.tracked.setup

              return (
                <button
                  key={s.tracked.id}
                  type="button"
                  onClick={() => setReviewSetup(s.tracked)}
                  className={`live-rail-card ${styleClass}`}
                >
                  <div className="live-rail-card__head">
                    <div className="live-rail-card__asset">
                      <span className="live-rail-card__coin">{coin}</span>
                      <span
                        className={`live-rail-card__direction ${
                          direction === 'long'
                            ? 'live-rail-card__direction--long'
                            : 'live-rail-card__direction--short'
                        }`}
                      >
                        {direction}
                      </span>
                    </div>
                    <span
                      className={`live-rail-card__confidence ${TIER_COLORS[confidenceTier] ?? 'text-text-muted'}`}
                    >
                      {confidenceTier}
                    </span>
                  </div>

                  <div className="live-rail-card__prices">
                    <span>
                      E <span className="text-text-primary">{formatPrice(entryPrice, coin as TrackedCoin)}</span>
                    </span>
                    <span className="text-text-muted">/</span>
                    <span>
                      S <span className="text-signal-red">{formatPrice(stopPrice, coin as TrackedCoin)}</span>
                    </span>
                    <span className="text-text-muted">/</span>
                    <span>
                      T <span className="text-signal-green">{formatPrice(targetPrice, coin as TrackedCoin)}</span>
                    </span>
                  </div>

                  <div className="live-rail-card__pnl-row">
                    <span className={`live-rail-card__pnl ${isProfit ? 'text-signal-green' : 'text-signal-red'}`}>
                      {formatPercent(s.unrealizedPct)}
                    </span>
                    <span
                      className={`live-rail-card__status ${
                        isProfit
                          ? s.heatTier === 'on-fire'
                            ? 'text-signal-green'
                            : s.heatTier === 'hot'
                              ? 'text-signal-green/70'
                              : 'text-text-muted'
                          : 'text-signal-red/70'
                      }`}
                    >
                      {isProfit ? HEAT_LABELS[s.heatTier] : 'Underwater'}
                    </span>
                  </div>

                  <div className="live-rail-card__progress-track">
                    <div
                      className={`live-rail-card__progress-fill ${
                        isProfit ? 'bg-signal-green' : 'bg-signal-red'
                      }`}
                      style={{ width: `${s.progressPct}%`, opacity: 0.5 + s.progressPct / 200 }}
                    />
                  </div>

                  <div className="live-rail-card__foot">
                    <span>
                      {isProfit
                        ? `${Math.round(s.progressPct)}% to target`
                        : `${Math.round(s.progressPct)}% to stop`}
                    </span>
                    <span>{timeAgo(generatedAt)}</span>
                  </div>
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

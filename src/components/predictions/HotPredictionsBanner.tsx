import { useState } from 'react'
import { useLiveSetups, type HeatTier } from '../../hooks/useHotPredictions'
import { formatPercent, formatPrice, timeAgo } from '../../utils/format'
import type { TrackedCoin } from '../../types/market'
import type { TrackedSetup } from '../../types/setup'
import { SignalDrawer } from '../shared/SignalDrawer'

/* ── Styling maps ────────────────────────────────────────────────────── */

const PROFIT_STYLES: Record<HeatTier, { border: string; bg: string; cls: string }> = {
  warm: {
    border: 'border-signal-green/20',
    bg: 'bg-signal-green/5',
    cls: '',
  },
  hot: {
    border: 'border-signal-green/40',
    bg: 'bg-signal-green/10',
    cls: 'shadow-[0_0_8px_0_rgba(34,197,94,0.12)]',
  },
  'on-fire': {
    border: 'border-signal-green/60',
    bg: 'bg-signal-green/15',
    cls: 'live-setup-card--on-fire',
  },
}

const UNDERWATER_STYLE = {
  border: 'border-signal-red/25',
  bg: 'bg-signal-red/5',
  cls: '',
}

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

/* ── Component ───────────────────────────────────────────────────────── */

export function LiveSetupsBanner() {
  const liveSetups = useLiveSetups()
  const [reviewSetup, setReviewSetup] = useState<TrackedSetup | null>(null)

  if (liveSetups.length === 0) return null

  const profitCount = liveSetups.filter((s) => s.status === 'profit').length
  const underwaterCount = liveSetups.length - profitCount

  return (
    <>
      <div className="border-b border-border-subtle/50 bg-bg-secondary/60 px-4 py-1.5 sm:px-6">
        <div className="mx-auto max-w-[1600px]">
          {/* Header */}
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Live Setups
            </span>
            {profitCount > 0 && (
              <span className="rounded-full bg-signal-green/15 px-1.5 py-0.5 text-[10px] font-semibold text-signal-green">
                {profitCount} winning
              </span>
            )}
            {underwaterCount > 0 && (
              <span className="rounded-full bg-signal-red/15 px-1.5 py-0.5 text-[10px] font-semibold text-signal-red">
                {underwaterCount} underwater
              </span>
            )}
          </div>

          {/* Cards */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {liveSetups.map((s) => {
              const isProfit = s.status === 'profit'
              const style = isProfit ? PROFIT_STYLES[s.heatTier] : UNDERWATER_STYLE
              const { coin, direction, confidenceTier, entryPrice, stopPrice, targetPrice, generatedAt } =
                s.tracked.setup

              return (
                <button
                  key={s.tracked.id}
                  onClick={() => setReviewSetup(s.tracked)}
                  className={`flex min-w-[170px] shrink-0 cursor-pointer flex-col gap-0.5 rounded-md border ${style.border} ${style.bg} ${style.cls} px-2.5 py-1.5 text-left transition-colors hover:bg-bg-card-hover`}
                >
                  {/* Row 1: coin + direction + confidence */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-text-primary">{coin}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          direction === 'long'
                            ? 'bg-signal-green/15 text-signal-green'
                            : 'bg-signal-red/15 text-signal-red'
                        }`}
                      >
                        {direction}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-medium uppercase ${TIER_COLORS[confidenceTier] ?? 'text-text-muted'}`}
                    >
                      {confidenceTier}
                    </span>
                  </div>

                  {/* Row 2: Entry / Stop / Target */}
                  <div className="flex items-center gap-2 text-[10px] text-text-secondary">
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

                  {/* Row 3: P&L + status label */}
                  <div className="flex items-baseline justify-between">
                    <span
                      className={`text-xs font-bold ${isProfit ? 'text-signal-green' : 'text-signal-red'}`}
                    >
                      {formatPercent(s.unrealizedPct)}
                    </span>
                    <span
                      className={`text-[10px] font-semibold uppercase ${
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

                  {/* Row 4: Progress bar */}
                  <div className="h-1 w-full overflow-hidden rounded-full bg-border-subtle/40">
                    <div
                      className={`h-full rounded-full transition-[width] duration-700 ${
                        isProfit ? 'bg-signal-green' : 'bg-signal-red'
                      }`}
                      style={{ width: `${s.progressPct}%`, opacity: 0.5 + s.progressPct / 200 }}
                    />
                  </div>

                  {/* Row 5: Progress label + time */}
                  <div className="flex items-center justify-between text-[10px] text-text-muted">
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
      </div>

      {/* Setup Autopsy drawer — opens when a card is clicked */}
      <SignalDrawer
        coin={reviewSetup?.setup.coin ?? 'BTC'}
        signalKind={reviewSetup ? 'setup' : null}
        trackedSetup={reviewSetup}
        onClose={() => setReviewSetup(null)}
      />
    </>
  )
}

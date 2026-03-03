import { useHotPredictions, type HeatTier } from '../../hooks/useHotPredictions'
import { useStore } from '../../store'
import { formatPercent, timeAgo } from '../../utils/format'
import type { TrackedCoin } from '../../types/market'

const HEAT_STYLES: Record<HeatTier, { border: string; bg: string; cls: string }> = {
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
    cls: 'prediction-card--on-fire',
  },
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

export function HotPredictionsBanner() {
  const predictions = useHotPredictions()
  const selectCoin = useStore((s) => s.selectCoin)

  if (predictions.length === 0) return null

  return (
    <div className="border-b border-border-subtle/50 bg-bg-secondary/60 px-4 py-3 sm:px-6">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Hot Predictions
          </span>
          <span className="rounded-full bg-signal-green/15 px-1.5 py-0.5 text-[10px] font-semibold text-signal-green">
            {predictions.length}
          </span>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1">
          {predictions.map((p) => {
            const style = HEAT_STYLES[p.heatTier]
            const { coin, direction, confidenceTier, generatedAt } = p.tracked.setup

            return (
              <button
                key={p.tracked.id}
                onClick={() => selectCoin(coin as TrackedCoin)}
                className={`flex min-w-[210px] shrink-0 cursor-pointer flex-col gap-2 rounded-lg border ${style.border} ${style.bg} ${style.cls} p-3 text-left transition-colors hover:bg-bg-card-hover`}
              >
                {/* Header: coin + direction + confidence */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-text-primary">{coin}</span>
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
                  <span className={`text-[10px] font-medium uppercase ${TIER_COLORS[confidenceTier] ?? 'text-text-muted'}`}>
                    {confidenceTier}
                  </span>
                </div>

                {/* P&L + heat label */}
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold text-signal-green">
                    {formatPercent(p.unrealizedPct)}
                  </span>
                  <span
                    className={`text-[10px] font-semibold uppercase ${
                      p.heatTier === 'on-fire'
                        ? 'text-signal-green'
                        : p.heatTier === 'hot'
                          ? 'text-signal-green/70'
                          : 'text-text-muted'
                    }`}
                  >
                    {HEAT_LABELS[p.heatTier]}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-border-subtle/40">
                  <div
                    className="h-full rounded-full bg-signal-green transition-[width] duration-700"
                    style={{ width: `${p.progressPct}%`, opacity: 0.5 + p.progressPct / 200 }}
                  />
                </div>

                {/* Footer: progress % + time */}
                <div className="flex items-center justify-between text-[11px] text-text-muted">
                  <span>{Math.round(p.progressPct)}% to target</span>
                  <span>{timeAgo(generatedAt)}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

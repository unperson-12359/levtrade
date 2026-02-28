import { useStore } from '../../store'
import { useSignals } from '../../hooks/useSignals'
import { CollapsibleSection } from '../shared/CollapsibleSection'
import { SignalBadge } from '../shared/SignalBadge'
import { Tooltip } from '../shared/Tooltip'
import { SIGNAL_TEXT_CLASSES, SIGNAL_BG_CLASSES, SIGNAL_BORDER_CLASSES, SIGNAL_COLORS } from '../../utils/colors'
import { regimeVerdict } from '../../utils/explanations'

const regimeLabels = {
  'trending': 'TRENDING',
  'mean-reverting': 'MEAN-REVERTING',
  'choppy': 'CHOPPY',
} as const

const regimeIcons = {
  'trending': '\u2192',       // →
  'mean-reverting': '\u2194', // ↔
  'choppy': '\u223F',         // ∿
} as const

export function RegimeSection() {
  const coin = useStore((s) => s.selectedCoin)
  const { signals } = useSignals(coin)

  if (!signals) {
    return (
      <CollapsibleSection
        id="regime"
        title="Market Environment"
        subtitle="What kind of market is this?"
        defaultExpanded
      >
        <div className="text-text-muted text-sm py-8 text-center">
          Loading market data...
        </div>
      </CollapsibleSection>
    )
  }

  const { hurst, volatility } = signals
  const verdict = regimeVerdict(coin, hurst, volatility)

  return (
    <CollapsibleSection
      id="regime"
      title="Market Environment"
      subtitle="What kind of market is this?"
      defaultExpanded
    >
      <div className="space-y-5">
        {/* Market Type + Volatility side by side */}
        <div className="grid grid-cols-2 gap-4">
          {/* Market Type Badge */}
          <div className={`rounded-lg border p-5 ${SIGNAL_BG_CLASSES[hurst.color]} ${SIGNAL_BORDER_CLASSES[hurst.color]}`}>
            <Tooltip content="This measures whether the market is moving in a clear direction (trending), bouncing between levels (mean-reverting), or moving randomly (choppy). Our signals work best in mean-reverting markets.">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider cursor-help">
                Market Type
              </span>
            </Tooltip>
            <div className={`mt-3 flex items-center gap-3 ${SIGNAL_TEXT_CLASSES[hurst.color]}`}>
              <span className="text-3xl">{regimeIcons[hurst.regime]}</span>
              <span className="text-xl font-bold">{regimeLabels[hurst.regime]}</span>
            </div>
            <p className="mt-3 text-sm text-text-secondary leading-relaxed">
              {hurst.explanation}
            </p>
            {/* Detail: Hurst value */}
            <div className="mt-3 text-xs text-text-muted font-mono">
              Hurst: {hurst.value.toFixed(3)} | Confidence: {(hurst.confidence * 100).toFixed(0)}%
            </div>
          </div>

          {/* Volatility Meter */}
          <div className={`rounded-lg border p-5 ${SIGNAL_BG_CLASSES[volatility.color]} ${SIGNAL_BORDER_CLASSES[volatility.color]}`}>
            <Tooltip content="How much the price is swinging. Low volatility means calm markets (tighter stops OK). High volatility means wild swings (use lower leverage, wider stops).">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider cursor-help">
                Price Swing Level
              </span>
            </Tooltip>
            <div className="mt-3 flex items-center gap-3">
              <SignalBadge
                label={volatility.level.toUpperCase()}
                color={volatility.color}
                size="md"
              />
            </div>
            {/* Volatility bar */}
            <div className="mt-4 h-3 rounded-full bg-bg-primary overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${Math.min(100, (volatility.realizedVol / 150) * 100)}%`,
                  backgroundColor: SIGNAL_COLORS[volatility.color],
                }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-text-muted">
              <span>Low</span>
              <span>Normal</span>
              <span>High</span>
              <span>Extreme</span>
            </div>
            <p className="mt-3 text-sm text-text-secondary leading-relaxed">
              {volatility.explanation}
            </p>
            <div className="mt-3 text-xs text-text-muted font-mono">
              Realized Vol: {volatility.realizedVol.toFixed(1)}% annualized | ATR: {volatility.atr.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Regime Verdict */}
        <div className={`rounded-lg border-l-4 p-4 ${SIGNAL_BG_CLASSES[hurst.color]}`} style={{ borderLeftColor: SIGNAL_COLORS[hurst.color] }}>
          <p className="text-base text-text-primary leading-relaxed font-medium">
            {verdict}
          </p>
        </div>
      </div>
    </CollapsibleSection>
  )
}

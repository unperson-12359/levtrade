import { useStore } from '../../store'
import { useSignals } from '../../hooks/useSignals'
import { CollapsibleSection } from '../shared/CollapsibleSection'
import { SignalBadge } from '../shared/SignalBadge'
import { SemiCircleGauge } from '../shared/SemiCircleGauge'
import { Tooltip } from '../shared/Tooltip'
import { SIGNAL_TEXT_CLASSES, SIGNAL_BG_CLASSES, SIGNAL_BORDER_CLASSES, SIGNAL_COLORS } from '../../utils/colors'
import { formatFundingRate } from '../../utils/format'

export function SignalSection() {
  const coin = useStore((s) => s.selectedCoin)
  const { signals } = useSignals(coin)

  if (!signals) {
    return (
      <CollapsibleSection
        id="signals"
        title="Signal Panel"
        subtitle="Should I go long, short, or stay out?"
        defaultExpanded
      >
        <div className="text-text-muted text-sm py-8 text-center">
          Loading signal data...
        </div>
      </CollapsibleSection>
    )
  }

  const { zScore, funding, oiDelta, composite } = signals

  return (
    <CollapsibleSection
      id="signals"
      title="Signal Panel"
      subtitle="Should I go long, short, or stay out?"
      defaultExpanded
    >
      <div className="space-y-6">
        {/* Three indicator cards */}
        <div className="grid grid-cols-3 gap-4">
          {/* Price Position (Z-Score) */}
          <div className={`rounded-lg border p-4 ${SIGNAL_BG_CLASSES[zScore.color]} ${SIGNAL_BORDER_CLASSES[zScore.color]}`}>
            <Tooltip content="This compares the current price to its average over the last 20 periods. When price is far from average, it tends to snap back. Think of it like a rubber band — the more you stretch it, the harder it snaps.">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider cursor-help">
                Price Position
              </span>
            </Tooltip>

            <div className="flex justify-center mt-3">
              <SemiCircleGauge
                value={zScore.value}
                min={-3}
                max={3}
                label={zScore.label}
                subLabel={`Z: ${zScore.value.toFixed(2)}`}
                color={zScore.color}
                size={160}
                leftLabel="Cheap"
                rightLabel="Expensive"
              />
            </div>

            <p className="text-xs text-text-secondary leading-relaxed mt-2">
              {zScore.explanation}
            </p>
          </div>

          {/* Crowd Positioning (Funding) */}
          <div className={`rounded-lg border p-4 ${SIGNAL_BG_CLASSES[funding.color]} ${SIGNAL_BORDER_CLASSES[funding.color]}`}>
            <Tooltip content="Funding rates show whether more traders are long or short. When everyone bets the same way, the market often moves against them. Extreme funding = potential reversal.">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider cursor-help">
                Crowd Positioning
              </span>
            </Tooltip>

            <div className="flex justify-center mt-3">
              <SemiCircleGauge
                value={funding.zScore}
                min={-3}
                max={3}
                label={funding.label}
                subLabel={`FR: ${formatFundingRate(funding.currentRate)}`}
                color={funding.color}
                size={160}
                leftLabel="Shorts"
                rightLabel="Longs"
              />
            </div>

            <p className="text-xs text-text-secondary leading-relaxed mt-2">
              {funding.explanation}
            </p>
          </div>

          {/* Money Flow (OI Delta) */}
          <div className={`rounded-lg border p-4 ${SIGNAL_BG_CLASSES[oiDelta.color]} ${SIGNAL_BORDER_CLASSES[oiDelta.color]}`}>
            <Tooltip content="Open Interest measures how much money is in the market. When price moves AND new money enters, the move is more likely to continue. When price moves but money exits, the move might be fake.">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider cursor-help">
                Money Flow
              </span>
            </Tooltip>

            <div className="mt-4 flex items-center justify-center gap-6">
              {/* OI Arrow */}
              <div className="text-center">
                <div className={`text-3xl ${oiDelta.oiChangePct >= 0 ? 'text-signal-green' : 'text-signal-red'}`}>
                  {oiDelta.oiChangePct >= 0 ? '\u2191' : '\u2193'}
                </div>
                <div className="text-[10px] text-text-muted mt-1">Open Interest</div>
              </div>

              {/* Confirmation badge */}
              <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${SIGNAL_TEXT_CLASSES[oiDelta.color]} ${SIGNAL_BG_CLASSES[oiDelta.color]}`}>
                {oiDelta.confirmation ? '\u2713 Confirmed' : '\u26A0 Diverging'}
              </div>

              {/* Price Arrow */}
              <div className="text-center">
                <div className={`text-3xl ${oiDelta.priceChangePct >= 0 ? 'text-signal-green' : 'text-signal-red'}`}>
                  {oiDelta.priceChangePct >= 0 ? '\u2191' : '\u2193'}
                </div>
                <div className="text-[10px] text-text-muted mt-1">Price</div>
              </div>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed mt-4">
              {oiDelta.explanation}
            </p>
          </div>
        </div>

        {/* Composite Signal - large central gauge */}
        <div className={`rounded-lg border p-6 ${SIGNAL_BG_CLASSES[composite.color]} ${SIGNAL_BORDER_CLASSES[composite.color]}`}>
          <div className="flex flex-col items-center">
            <SemiCircleGauge
              value={composite.value}
              min={-1}
              max={1}
              label={composite.label}
              subLabel={`Score: ${composite.value.toFixed(2)}`}
              color={composite.color}
              size={220}
              leftLabel="STRONG SHORT"
              rightLabel="STRONG LONG"
            />

            {/* Agreement badge */}
            <div className="flex items-center gap-2 mt-3">
              <SignalBadge
                label={`${composite.agreementCount}/${composite.agreementTotal} agree`}
                color={composite.agreementCount >= 3 ? 'green' : composite.agreementCount >= 2 ? 'yellow' : 'red'}
                size="sm"
              />
              <SignalBadge
                label={composite.strength.toUpperCase()}
                color={composite.color}
                size="sm"
              />
            </div>
          </div>

          {/* Decision sentence */}
          <div className="mt-5 rounded-lg border-l-4 p-4" style={{ borderLeftColor: SIGNAL_COLORS[composite.color], backgroundColor: 'rgba(0,0,0,0.2)' }}>
            <p className="text-base text-text-primary leading-relaxed font-medium">
              {composite.explanation}
            </p>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  )
}

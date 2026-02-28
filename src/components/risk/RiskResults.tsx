import { usePositionRisk } from '../../hooks/usePositionRisk'
import { SignalBadge } from '../shared/SignalBadge'
import { formatUSD, formatPercent, formatPrice } from '../../utils/format'
import { SIGNAL_COLORS, SIGNAL_TEXT_CLASSES } from '../../utils/colors'

export function RiskResults() {
  const { inputs, outputs, isReady } = usePositionRisk()

  if (!isReady || !outputs) {
    return (
      <div className="flex items-center justify-center text-text-muted text-base">
        Enter trade parameters to see risk analysis
      </div>
    )
  }

  const isImmune = outputs.liquidationDistance >= 100
  const liqColor = isImmune || outputs.liquidationDistance > 20 ? 'green' as const : outputs.liquidationDistance > 10 ? 'yellow' as const : 'red' as const
  const lossColor = outputs.lossAtStopPercent < 1 ? 'green' as const : outputs.lossAtStopPercent < 2 ? 'yellow' as const : 'red' as const
  const rrColor = outputs.rrRatio >= 3 ? 'green' as const : outputs.rrRatio >= 2 ? 'yellow' as const : 'red' as const

  return (
    <div className="space-y-5">
      {/* Trade Grade Banner */}
      <div className="rounded-lg border border-border-subtle bg-bg-card p-6">
        <div className="flex items-center gap-3 mb-2">
          <SignalBadge label={outputs.tradeGradeLabel} color={outputs.tradeGrade} />
        </div>
        <p className="text-base text-text-primary leading-relaxed">
          {outputs.tradeGradeExplanation}
        </p>
      </div>

      {/* Risk at Stop */}
      <div className="rounded-lg border border-border-subtle bg-bg-card p-6">
        <div className="text-sm text-text-muted uppercase tracking-wider mb-2">Risk at Stop</div>
        <div className="flex items-baseline gap-3">
          <span className={`font-mono text-2xl font-bold ${SIGNAL_TEXT_CLASSES[lossColor]}`}>
            {formatUSD(outputs.lossAtStop)}
          </span>
          <span className="text-base text-text-secondary">
            ({formatPercent(outputs.lossAtStopPercent, 1)} of account)
          </span>
        </div>
        <p className="text-sm text-text-secondary mt-2">
          Stop at {formatPrice(outputs.suggestedStopPrice, inputs.coin)}
        </p>
      </div>

      {/* Reward : Risk */}
      <div className="rounded-lg border border-border-subtle bg-bg-card p-6">
        <div className="text-sm text-text-muted uppercase tracking-wider mb-2">Reward : Risk</div>
        <div className="flex items-baseline gap-3">
          <span className={`font-mono text-2xl font-bold ${SIGNAL_TEXT_CLASSES[rrColor]}`}>
            {outputs.rrRatio.toFixed(1)} : 1
          </span>
        </div>
        {/* R:R labels above bar */}
        <div className="mt-3 flex gap-1 text-sm text-text-secondary mb-1">
          <span>Risk</span>
          <span className="ml-auto">Reward</span>
        </div>
        {/* Visual R:R bar */}
        <div className="flex gap-1 h-4 rounded overflow-hidden">
          <div
            className="rounded-l"
            style={{
              width: `${(1 / (1 + outputs.rrRatio)) * 100}%`,
              backgroundColor: SIGNAL_COLORS.red,
              minWidth: '10%',
            }}
          />
          <div
            className="rounded-r"
            style={{
              width: `${(outputs.rrRatio / (1 + outputs.rrRatio)) * 100}%`,
              backgroundColor: SIGNAL_COLORS.green,
              minWidth: '10%',
            }}
          />
        </div>
        <p className="text-sm text-text-secondary mt-2">
          Target at {formatPrice(outputs.suggestedTargetPrice, inputs.coin)} | Potential profit: {formatUSD(outputs.profitAtTarget)}
        </p>
      </div>

      {/* Liquidation Distance */}
      <div className="rounded-lg border border-border-subtle bg-bg-card p-6">
        <div className="text-sm text-text-muted uppercase tracking-wider mb-2">Liquidation Distance</div>
        <div className="flex items-baseline gap-3">
          <span className={`font-mono text-2xl font-bold ${SIGNAL_TEXT_CLASSES[liqColor]}`}>
            {isImmune ? 'Effectively Immune' : formatPercent(outputs.liquidationDistance, 1)}
          </span>
          {!isImmune && <span className="text-base text-text-secondary">away</span>}
        </div>
        <p className="text-sm text-text-secondary mt-2">
          {isImmune
            ? 'Your account size far exceeds position risk — liquidation is practically impossible.'
            : `Liquidation at ${formatPrice(outputs.liquidationPrice, inputs.coin)}`
          }
        </p>
        {/* Visual bar */}
        {!isImmune && (
          <div className="mt-3 h-2 rounded-full bg-bg-primary overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, outputs.liquidationDistance * 3)}%`,
                backgroundColor: SIGNAL_COLORS[liqColor],
              }}
            />
          </div>
        )}
      </div>

      {/* Suggested Position Size */}
      <div className="rounded-lg border border-border-subtle p-6 bg-bg-card">
        <div className="text-sm text-text-muted uppercase tracking-wider mb-2">Suggested Position (1% Risk)</div>
        <div className="font-mono text-lg font-bold text-signal-blue">
          {formatUSD(outputs.suggestedPositionSize)}
        </div>
        <p className="text-sm text-text-secondary mt-1">
          At {outputs.suggestedLeverage.toFixed(1)}x leverage to risk no more than 1% of your account
        </p>
      </div>
    </div>
  )
}

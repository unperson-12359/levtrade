import { usePositionRisk } from '../../hooks/usePositionRisk'
import { formatPercent, formatPrice, formatUSD } from '../../utils/format'
import { SIGNAL_COLORS, SIGNAL_TEXT_CLASSES } from '../../utils/colors'
import { SignalBadge } from '../shared/SignalBadge'
import { JargonTerm } from '../shared/JargonTerm'

export function RiskResults() {
  const { inputs, outputs, isReady, riskStatus } = usePositionRisk()

  if (!isReady || !outputs) {
    return (
      <div className="panel-shell panel-shell--tight">
        <div className="text-base text-text-muted">Enter trade parameters to see live risk geometry.</div>
      </div>
    )
  }

  const isImmune = outputs.effectiveImmune
  const liqColor = isImmune || outputs.liquidationDistance > 20 ? 'green' as const : outputs.liquidationDistance > 10 ? 'yellow' as const : 'red' as const
  const rrColor = outputs.rrRatio >= 3 ? 'green' as const : outputs.rrRatio >= 2 ? 'yellow' as const : 'red' as const
  const lossColor = outputs.lossAtStopPercent < 1 ? 'green' as const : outputs.lossAtStopPercent < 2 ? 'yellow' as const : 'red' as const

  return (
    <div className="space-y-4">
      <section className="panel-shell panel-shell--tight">
        <div className="panel-header">
          <div>
            <div className="panel-kicker">Risk Verdict</div>
            <h3 className="panel-title">Position geometry</h3>
          </div>
          <SignalBadge label={outputs.tradeGradeLabel} color={outputs.tradeGrade} size="sm" />
        </div>
        <p className="panel-copy">{outputs.tradeGradeExplanation}</p>
        <div className="decision-strip__chips mt-3">
          <span className={`status-pill status-pill--${riskStatus === 'safe' ? 'green' : riskStatus === 'borderline' ? 'yellow' : 'red'}`}>
            {riskStatus.toUpperCase()}
          </span>
          <span className="inline-flex items-center rounded-full border border-border-subtle px-3 py-1 text-sm text-text-secondary">
            {outputs.usedCustomStop ? 'Custom stop' : 'Auto stop'}
          </span>
          <span className="inline-flex items-center rounded-full border border-border-subtle px-3 py-1 text-sm text-text-secondary">
            {outputs.usedCustomTarget ? 'Custom target' : 'Auto target'}
          </span>
        </div>
        {(outputs.stopValidationMessage || outputs.targetValidationMessage) && (
          <div className="mt-3 space-y-2">
            {outputs.stopValidationMessage && <WarningText text={outputs.stopValidationMessage} />}
            {outputs.targetValidationMessage && <WarningText text={outputs.targetValidationMessage} />}
          </div>
        )}
        <div className={`action-guidance action-guidance--${outputs.tradeGrade}`}>
          {outputs.tradeGrade === 'green'
            ? 'Trade parameters look good. You can proceed with this entry.'
            : outputs.tradeGrade === 'yellow'
            ? 'Acceptable but tight. Consider reducing leverage or position size.'
            : 'Do not enter with these parameters. Reduce leverage or size.'}
        </div>
      </section>

      {outputs.hasInputError && (
        <section className="panel-shell panel-shell--tight">
          <WarningText text={outputs.inputErrorMessage ?? 'Invalid trade input.'} />
        </section>
      )}

      {outputs.hasInputError ? null : (
        <>
          <section className="panel-shell panel-shell--tight">
            <div className="panel-kicker">Stop Geometry</div>
            <div className="stat-grid">
              <Stat label="Risk At Stop" value={formatUSD(outputs.lossAtStop)} tone={lossColor} />
              <Stat label="Account Hit" value={formatPercent(outputs.lossAtStopPercent, 1)} tone={lossColor} />
              <Stat label="Effective Stop" value={formatPrice(outputs.effectiveStopPrice, inputs.coin)} tone="red" />
              <Stat label="Suggested Stop" value={formatPrice(outputs.suggestedStopPrice, inputs.coin)} tone="yellow" />
            </div>
          </section>

          <section className="panel-shell panel-shell--tight">
            <div className="panel-kicker">Reward Geometry</div>
            <div className="stat-grid">
              <Stat label={<JargonTerm term="R:R" />} value={`${outputs.rrRatio.toFixed(1)} : 1`} tone={rrColor} />
              <Stat label="Target Payout" value={formatUSD(outputs.profitAtTarget)} tone="green" />
              <Stat label="Effective Target" value={formatPrice(outputs.effectiveTargetPrice, inputs.coin)} tone="green" />
              <Stat label="Suggested Target" value={formatPrice(outputs.suggestedTargetPrice, inputs.coin)} tone="yellow" />
            </div>
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-sm text-text-secondary">
                <span>Risk</span>
                <span>Reward</span>
              </div>
              <div className="flex h-3 gap-1 overflow-hidden rounded-full">
                <div
                  style={{
                    width: `${(1 / (1 + outputs.rrRatio)) * 100}%`,
                    backgroundColor: SIGNAL_COLORS.red,
                    minWidth: '12%',
                  }}
                />
                <div
                  style={{
                    width: `${(outputs.rrRatio / (1 + outputs.rrRatio)) * 100}%`,
                    backgroundColor: SIGNAL_COLORS.green,
                    minWidth: '12%',
                  }}
                />
              </div>
            </div>
          </section>

          <section className="panel-shell panel-shell--tight">
            <div className="panel-kicker"><JargonTerm term="Liquidation">Liquidation</JargonTerm> and Size</div>
            <div className="stat-grid">
              <Stat label={<JargonTerm term="Liquidation" />} value={isImmune ? 'IMMUNE' : formatPrice(outputs.liquidationPrice, inputs.coin)} tone={liqColor} />
              <Stat label="Distance" value={isImmune ? '100%+' : formatPercent(outputs.liquidationDistance, 1)} tone={liqColor} />
              <Stat label="1% Size" value={formatUSD(outputs.suggestedPositionSize)} tone="green" />
              <Stat label="1% Leverage" value={`${outputs.suggestedLeverage.toFixed(1)}x`} tone="green" />
            </div>
            <div className="mt-3 space-y-2 text-sm text-text-secondary">
              {outputs.hasLiquidation ? (
                <div>
                  Current setup liquidates at {formatPrice(outputs.liquidationPrice, inputs.coin)}, about{' '}
                  {formatPercent(outputs.liquidationDistance, 1)} from entry.
                </div>
              ) : outputs.minLeverageForLiquidation !== null && outputs.liquidationPriceAtMinLeverage !== null ? (
                <>
                  <div>{outputs.liquidationFallbackExplanation}</div>
                  <div className="inline-flex flex-wrap items-center gap-2">
                    <span className="warning-chip warning-chip--yellow">
                      Min leverage with liq: {outputs.minLeverageForLiquidation.toFixed(1)}x
                    </span>
                    <span className="warning-chip warning-chip--yellow">
                      Liq there: {formatPrice(outputs.liquidationPriceAtMinLeverage, inputs.coin)}
                    </span>
                    {outputs.liquidationDistanceAtMinLeverage !== null && (
                      <span className="warning-chip warning-chip--yellow">
                        Distance there: {formatPercent(outputs.liquidationDistanceAtMinLeverage, 1)}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div>
                  This setup stays non-liquidatable even through the fallback leverage search. The notional is too conservative relative to account size.
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function WarningText({ text }: { text: string }) {
  return <div className="warning-chip warning-chip--red">{text}</div>
}

interface StatProps {
  label: React.ReactNode
  value: string
  tone: 'green' | 'yellow' | 'red'
}

function Stat({ label, value, tone }: StatProps) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${SIGNAL_TEXT_CLASSES[tone]}`}>{value}</div>
    </div>
  )
}

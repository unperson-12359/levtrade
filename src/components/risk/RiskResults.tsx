import { usePositionRisk } from '../../hooks/usePositionRisk'
import { useEntryDecision } from '../../hooks/useEntryDecision'
import { formatPercent, formatPrice, formatUSD } from '../../utils/format'
import { SIGNAL_COLORS, SIGNAL_TEXT_CLASSES } from '../../utils/colors'
import { getEntryWorkflowGuidance, getMarketWorkflowGuidance, getRiskWorkflowGuidance } from '../../utils/workflowGuidance'
import { SignalBadge } from '../shared/SignalBadge'
import { ExpandableSection } from '../shared/ExpandableSection'
import { JargonTerm } from '../shared/JargonTerm'
import { useSignals } from '../../hooks/useSignals'

export function RiskResults() {
  const { inputs, outputs, isReady, riskStatus } = usePositionRisk()
  const { signals } = useSignals(inputs.coin)
  const decision = useEntryDecision(inputs.coin)

  if (!isReady || !outputs) {
    return (
      <div className="panel-shell panel-shell--tight">
        <div className="text-base text-text-muted">Enter trade parameters to see live risk geometry.</div>
      </div>
    )
  }

  const isImmune = outputs.effectiveImmune
  const hasPositionSizeInput = inputs.positionSize > 0
  const liqColor = isImmune || outputs.liquidationDistance > 20 ? 'green' as const : outputs.liquidationDistance > 10 ? 'yellow' as const : 'red' as const
  const rrColor = outputs.rrRatio >= 3 ? 'green' as const : outputs.rrRatio >= 2 ? 'yellow' as const : 'red' as const
  const lossColor = outputs.lossAtStopPercent < 1 ? 'green' as const : outputs.lossAtStopPercent < 2 ? 'yellow' as const : 'red' as const
  const marketGuidance = getMarketWorkflowGuidance(signals)
  const entryGuidance = getEntryWorkflowGuidance(signals, decision, marketGuidance)
  const riskGuidance = getRiskWorkflowGuidance(outputs, riskStatus, entryGuidance)

  return (
    <div className="space-y-4">
      <section className="panel-shell panel-shell--tight">
        <div className="panel-header">
          <div>
            <div className="panel-kicker">Risk Verdict</div>
            <h3 className="panel-title">Is this trade sized safely enough?</h3>
          </div>
          <SignalBadge label={outputs.tradeGradeLabel} color={outputs.tradeGrade} size="sm" />
        </div>
        <p className="panel-copy">{riskGuidance.summary}</p>
        <div className="decision-strip__chips mt-3">
          <span className={`status-pill status-pill--${riskGuidance.tone}`}>
            {riskGuidance.label}
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
      </section>

      {outputs.hasInputError ? null : (
        <ExpandableSection sectionId="step3-advanced" title="advanced risk details">
          <div className="space-y-4">
            <section className="subpanel-shell">
              <div className="panel-kicker">Stop geometry</div>
              <div className="stat-grid">
                <Stat label="Risk at stop" value={formatUSD(outputs.lossAtStop)} tone={lossColor} />
                <Stat label="Account hit" value={formatPercent(outputs.lossAtStopPercent, 1)} tone={lossColor} />
                <Stat label="Effective stop" value={formatPrice(outputs.effectiveStopPrice, inputs.coin)} tone="red" />
                <Stat label="Suggested stop" value={formatPrice(outputs.suggestedStopPrice, inputs.coin)} tone="yellow" />
              </div>
            </section>

            <section className="subpanel-shell">
              <div className="panel-kicker">Reward geometry</div>
              <div className="stat-grid">
                <Stat label={<JargonTerm term="R:R" />} value={`${outputs.rrRatio.toFixed(1)} : 1`} tone={rrColor} />
                <Stat label="Target payout" value={formatUSD(outputs.profitAtTarget)} tone="green" />
                <Stat label="Effective target" value={formatPrice(outputs.effectiveTargetPrice, inputs.coin)} tone="green" />
                <Stat label="Suggested target" value={formatPrice(outputs.suggestedTargetPrice, inputs.coin)} tone="yellow" />
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

            <section className="subpanel-shell">
              <div className="panel-kicker"><JargonTerm term="Liquidation">Liquidation</JargonTerm> and size</div>
              <div className="stat-grid">
                <Stat
                  label={<JargonTerm term="Liquidation" />}
                  value={!hasPositionSizeInput ? 'ENTER SIZE' : isImmune ? 'IMMUNE' : formatPrice(outputs.liquidationPrice, inputs.coin)}
                  tone={!hasPositionSizeInput ? 'yellow' : liqColor}
                />
                <Stat
                  label="Distance"
                  value={!hasPositionSizeInput ? '--' : isImmune ? '100%+' : formatPercent(outputs.liquidationDistance, 1)}
                  tone={!hasPositionSizeInput ? 'yellow' : liqColor}
                />
                <Stat label="1% size" value={formatUSD(outputs.suggestedPositionSize)} tone="green" />
                <Stat label="1% leverage" value={`${outputs.suggestedLeverage.toFixed(1)}x`} tone="green" />
              </div>
              <div className="mt-3 space-y-2 text-sm text-text-secondary">
                {!hasPositionSizeInput ? (
                  <div>{outputs.liquidationFallbackExplanation}</div>
                ) : outputs.hasLiquidation ? (
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
          </div>
        </ExpandableSection>
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

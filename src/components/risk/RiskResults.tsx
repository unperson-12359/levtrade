import { usePositionRisk } from '../../hooks/usePositionRisk'
import { useEntryDecision } from '../../hooks/useEntryDecision'
import { formatPercent, formatPrice, formatUSD } from '../../utils/format'
import { formatRR } from '../../utils/setupFormat'
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
      <>
        <hr className="risk-divider" />
        <div className="text-base text-text-muted">Enter trade parameters to see live risk geometry.</div>
      </>
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
    <div className="space-y-3">
      <hr className="risk-divider" />
      <div className="risk-verdict-strip">
        <SignalBadge label={outputs.tradeGradeLabel} color={outputs.tradeGrade} size="sm" />
        <p className="risk-verdict-strip__summary">{riskGuidance.summary}</p>
        <div className="risk-verdict-strip__pills">
          <span className={`status-pill status-pill--${riskGuidance.tone}`}>
            {riskGuidance.label}
          </span>
          <span className="inline-flex items-center rounded-full border border-border-subtle px-2 py-0.5 text-xs text-text-secondary">
            Stop {formatPrice(outputs.effectiveStopPrice, inputs.coin)}
          </span>
          <span className="inline-flex items-center rounded-full border border-border-subtle px-2 py-0.5 text-xs text-text-secondary">
            Target {formatPrice(outputs.effectiveTargetPrice, inputs.coin)}
          </span>
        </div>
      </div>
      {(outputs.stopValidationMessage || outputs.targetValidationMessage) && (
        <div className="space-y-1">
          {outputs.stopValidationMessage && <WarningText text={outputs.stopValidationMessage} />}
          {outputs.targetValidationMessage && <WarningText text={outputs.targetValidationMessage} />}
        </div>
      )}

      {outputs.hasInputError ? null : (
        <ExpandableSection sectionId="step3-advanced" title="advanced risk details">
          <div className="space-y-4">
            <section className="subpanel-shell">
              <div className="panel-kicker">Trade geometry</div>
              <div className="stat-grid">
                <Stat label="Risk at stop" value={formatUSD(outputs.lossAtStop)} tone={lossColor} />
                <Stat label="Target payout" value={formatUSD(outputs.profitAtTarget)} tone="green" />
                <Stat label="Account hit" value={formatPercent(outputs.lossAtStopPercent, 1)} tone={lossColor} />
                <Stat label="Account gain" value={formatPercent(outputs.profitAtTargetPercent, 1)} tone="green" />
              </div>
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Risk</span>
                  <span className={`font-mono font-bold ${SIGNAL_TEXT_CLASSES[rrColor]}`}>
                    <JargonTerm term="R:R" /> {formatRR(outputs.rrRatio)}
                  </span>
                  <span className="text-text-secondary">Reward</span>
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
              {(outputs.usedCustomStop || outputs.usedCustomTarget) && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-text-muted">
                  {outputs.usedCustomStop && (
                    <span>
                      Custom stop {formatPrice(outputs.effectiveStopPrice, inputs.coin)}{' '}
                      <span className="text-text-secondary">
                        vs auto {formatPrice(outputs.suggestedStopPrice, inputs.coin)}
                      </span>
                    </span>
                  )}
                  {outputs.usedCustomTarget && (
                    <span>
                      Custom target {formatPrice(outputs.effectiveTargetPrice, inputs.coin)}{' '}
                      <span className="text-text-secondary">
                        vs auto {formatPrice(outputs.suggestedTargetPrice, inputs.coin)}
                      </span>
                    </span>
                  )}
                </div>
              )}
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
                <Stat label="1% margin" value={formatUSD(outputs.suggestedPositionSize)} tone="green" />
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

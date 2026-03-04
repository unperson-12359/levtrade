import type { ReactNode } from 'react'
import { useSuggestedPosition } from '../../hooks/useSuggestedPosition'
import { formatPercent, formatPrice, formatUSD } from '../../utils/format'
import { formatRR } from '../../utils/setupFormat'
import { SIGNAL_TEXT_CLASSES } from '../../utils/colors'
import { SignalBadge } from '../shared/SignalBadge'
import { ExpandableSection } from '../shared/ExpandableSection'
import { JargonTerm } from '../shared/JargonTerm'

export function RiskResults() {
  const composition = useSuggestedPosition()
  const { setup, outputs, inputs } = composition

  if (composition.mode === 'none' || composition.status === 'none' || !setup) {
    return (
      <div className="risk-results risk-results--compact opacity-70">
        <hr className="risk-divider" />
        <div className="workflow-summary-card risk-results__empty">
          <div className="workflow-summary-card__kicker">No directional composition right now</div>
          <p className="workflow-summary-card__copy">
            {composition.display.modeExplanation}
          </p>
        </div>
      </div>
    )
  }

  if (composition.status === 'invalid' || !outputs || outputs.hasInputError) {
    return (
      <div className="risk-results risk-results--compact">
        <hr className="risk-divider" />
        <div className="workflow-summary-card risk-results__empty">
          <div className="workflow-summary-card__kicker">
            {composition.mode === 'validated' ? 'Validated composition needs capital' : 'Provisional composition needs capital'}
          </div>
          <p className="workflow-summary-card__copy">{composition.display.explanation}</p>
        </div>
      </div>
    )
  }

  const liqColor =
    outputs.effectiveImmune || outputs.liquidationDistance > 20
      ? 'green'
      : outputs.liquidationDistance > 10
        ? 'yellow'
        : 'red'
  const rrColor = outputs.rrRatio >= 3 ? 'green' : outputs.rrRatio >= 2 ? 'yellow' : 'red'
  const lossColor =
    outputs.lossAtStopPercent < 1 ? 'green' : outputs.lossAtStopPercent < 2 ? 'yellow' : 'red'
  const targetGainColor = outputs.profitAtTargetPercent >= 2 ? 'green' : outputs.profitAtTargetPercent >= 1 ? 'yellow' : 'red'

  return (
    <div className="risk-results risk-results--compact">
      <hr className="risk-divider" />

      <div className="risk-verdict-strip risk-verdict-strip--compact">
        <SignalBadge
          label={composition.display.modeLabel}
          color={composition.mode === 'validated' ? 'green' : 'yellow'}
          size="sm"
        />
        <SignalBadge label={outputs.tradeGradeLabel} color={outputs.tradeGrade} size="sm" />
        <p className="risk-verdict-strip__summary">{outputs.tradeGradeExplanation}</p>
        <div className="risk-verdict-strip__pills">
          <span className={`status-pill status-pill--${setup.direction === 'long' ? 'green' : 'red'}`}>
            {setup.direction.toUpperCase()}
          </span>
          <span className={`status-pill status-pill--${outputs.tradeGrade}`}>{outputs.tradeGradeLabel}</span>
          <span className="inline-flex items-center rounded-full border border-border-subtle px-2 py-0.5 text-xs text-text-secondary">
            Capital {formatUSD(inputs.accountSize)}
          </span>
        </div>
      </div>

      {composition.mode === 'provisional' && (
        <div className="workflow-summary-card risk-results__draft-note">
          <div className="workflow-summary-card__kicker">Reduced-risk draft</div>
          <p className="workflow-summary-card__copy">
            Step 2 is cautionary, so LevTrade applies a lower risk target and allocation cap.
          </p>
        </div>
      )}

      <div className="risk-kpi-grid risk-kpi-grid--compact">
        <Stat label="Capital used" value={formatUSD(inputs.positionSize)} tone="yellow" />
        <Stat label="Suggested leverage" value={`${inputs.leverage.toFixed(1)}x`} tone="yellow" />
        <Stat label={<JargonTerm term="R:R">Reward vs risk</JargonTerm>} value={formatRR(outputs.rrRatio)} tone={rrColor} />
        <Stat label="Account hit at stop" value={formatPercent(outputs.lossAtStopPercent, 1)} tone={lossColor} />
        <Stat
          label="Liquidation safety"
          value={outputs.effectiveImmune ? 'IMMUNE' : formatPercent(outputs.liquidationDistance, 1)}
          tone={liqColor}
        />
      </div>

      <ExpandableSection sectionId="step3-advanced" title="advanced composition details">
        <div className="risk-results__advanced">
          <section className="subpanel-shell risk-results__advanced-section">
            <div className="panel-kicker">Secondary metrics</div>
            <div className="risk-kpi-grid risk-kpi-grid--secondary">
              <Stat label="Notional" value={formatUSD(outputs.notionalValue)} tone="green" />
              <Stat
                label="Target account risk"
                value={composition.display.targetRiskPct !== null ? formatPercent(composition.display.targetRiskPct * 100, 2) : '--'}
                tone="yellow"
              />
              <Stat
                label="Max capital allocation"
                value={composition.display.capitalFractionCap !== null ? formatPercent(composition.display.capitalFractionCap * 100, 0) : '--'}
                tone="yellow"
              />
              <Stat label="Target gain" value={formatPercent(outputs.profitAtTargetPercent, 1)} tone={targetGainColor} />
              <Stat label="Trade timeframe" value={setup.timeframe} tone="yellow" />
            </div>
          </section>

          <section className="subpanel-shell risk-results__advanced-section">
            <div className="panel-kicker">Setup geometry</div>
            <div className="risk-kpi-grid risk-kpi-grid--secondary">
              <Stat label="Entry" value={formatPrice(setup.entryPrice, setup.coin)} tone="yellow" />
              <Stat label="Stop" value={formatPrice(setup.stopPrice, setup.coin)} tone="red" />
              <Stat label="Target" value={formatPrice(setup.targetPrice, setup.coin)} tone="green" />
              <Stat label="Mean target" value={formatPrice(setup.meanReversionTarget, setup.coin)} tone="yellow" />
            </div>
          </section>

          <section className="subpanel-shell risk-results__advanced-section">
            <div className="panel-kicker">Capital geometry</div>
            <div className="risk-kpi-grid risk-kpi-grid--secondary">
              <Stat label="Risk at stop" value={formatUSD(outputs.lossAtStop)} tone={lossColor} />
              <Stat label="Target payout" value={formatUSD(outputs.profitAtTarget)} tone="green" />
              <Stat label="Liquidation" value={outputs.effectiveImmune ? 'IMMUNE' : formatPrice(outputs.liquidationPrice, setup.coin)} tone={liqColor} />
              <Stat label="Distance" value={outputs.effectiveImmune ? '100%+' : formatPercent(outputs.liquidationDistance, 1)} tone={liqColor} />
            </div>
            {outputs.liquidationFallbackExplanation && (
              <div className="panel-copy risk-results__fallback">{outputs.liquidationFallbackExplanation}</div>
            )}
          </section>
        </div>
      </ExpandableSection>
    </div>
  )
}

function Stat({ label, value, tone }: { label: ReactNode; value: string; tone: 'green' | 'yellow' | 'red' }) {
  return (
    <div className="risk-stat-card">
      <div className="risk-stat-card__label">{label}</div>
      <div className={`risk-stat-card__value ${SIGNAL_TEXT_CLASSES[tone]}`}>{value}</div>
    </div>
  )
}

import { useState } from 'react'
import { useStore } from '../../store'
import { useSignals } from '../../hooks/useSignals'
import { formatFundingRate, formatPercent, timeAgo } from '../../utils/format'
import { getMarketWorkflowGuidance } from '../../utils/workflowGuidance'
import type { SignalSeriesKind } from '../../utils/provenance'
import { ExpandableSection } from '../shared/ExpandableSection'
import { JargonTerm } from '../shared/JargonTerm'
import { StepLabel } from '../methodology/StepLabel'
import { SignalDrawer } from '../shared/SignalDrawer'

export function MarketRail() {
  const coin = useStore((s) => s.selectedCoin)
  const { signals, isWarmingUp, warmupProgress } = useSignals(coin)
  const guidance = getMarketWorkflowGuidance(signals)
  const [drawerKind, setDrawerKind] = useState<SignalSeriesKind | null>(null)

  if (!signals) {
    return (
      <section className="panel-shell">
        <StepLabel step={1} />
        <div className="panel-kicker">Step 1</div>
        <h2 className="panel-title">Can I trade this market?</h2>
        <div className="loading-block h-24" />
      </section>
    )
  }

  return (
    <section className="panel-shell">
      <StepLabel step={1} />
      <div className="panel-header">
        <div>
          <div className="panel-kicker">Step 1</div>
          <h2 className="panel-title">Is this market favorable for this strategy?</h2>
        </div>
        <span className={`status-pill status-pill--${guidance.tone}`}>{guidance.label}</span>
      </div>

      <p className="panel-copy">{guidance.summary}</p>

      {(isWarmingUp || signals.isStale) && (
        <div className="decision-strip__chips">
          {isWarmingUp && (
            <span className="warning-chip warning-chip--yellow">
              Warmup {(warmupProgress * 100).toFixed(0)}%
            </span>
          )}
          {signals.isStale && (
            <span className="warning-chip warning-chip--red">
              Last computed {timeAgo(signals.updatedAt)}
            </span>
          )}
        </div>
      )}
      <ExpandableSection sectionId="step1-advanced" title="advanced market details">
        <div className="market-rail-grid">
          <section className="subpanel-shell">
            <div className="panel-kicker">Regime details</div>
            <div className={`mini-panel-title ${signals.hurst.color === 'green' ? 'text-signal-green' : signals.hurst.color === 'yellow' ? 'text-signal-yellow' : 'text-signal-red'}`}>
              {signals.hurst.regime.toUpperCase()}
            </div>
            <div className="rail-rows">
              <div className="rail-row">
                <span><JargonTerm term="Hurst" /></span>
                <span className="font-mono text-text-primary">{signals.hurst.value.toFixed(3)}</span>
              </div>
              <div className="rail-row">
                <span>Confidence</span>
                <span className="font-mono text-text-primary">{(signals.hurst.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
            <p className="panel-copy">{signals.hurst.explanation}</p>
            <button type="button" className="signal-link-button" onClick={() => setDrawerKind('hurst')}>
              See chart -&gt;
            </button>
          </section>

          <MiniPanel
            kicker="Volatility"
            title={signals.volatility.level.toUpperCase()}
            tone={signals.volatility.color}
          rows={[
              { label: 'Realized Vol', value: `${signals.volatility.realizedVol.toFixed(1)}%` },
              { label: <JargonTerm term="ATR" />, value: signals.volatility.atr.toFixed(2) },
            ]}
            copy={signals.volatility.explanation}
            chartKind="atr"
            onOpenChart={setDrawerKind}
          />

          <MiniPanel
            kicker="Funding"
            title={signals.funding.label}
            tone={signals.funding.color}
            rows={[
              { label: <JargonTerm term="Funding Rate">Rate</JargonTerm>, value: formatFundingRate(signals.funding.currentRate) },
              { label: <JargonTerm term="Z-Score">Z-Score</JargonTerm>, value: signals.funding.zScore.toFixed(2) },
            ]}
            copy={signals.funding.explanation}
            chartKind="fundingRate"
            onOpenChart={setDrawerKind}
          />

          <MiniPanel
            kicker="Money flow"
            title={signals.oiDelta.label}
            tone={signals.oiDelta.color}
            rows={[
              { label: <JargonTerm term="OI Delta">OI Delta</JargonTerm>, value: formatPercent(signals.oiDelta.oiChangePct * 100, 2) },
              { label: 'Price Delta', value: formatPercent(signals.oiDelta.priceChangePct * 100, 2) },
            ]}
            copy={signals.oiDelta.explanation}
            footerNote="Live session data only"
          />

          <MiniPanel
            kicker="Overall agreement"
            title={signals.composite.label}
            tone={signals.composite.color}
            rows={[
              { label: <JargonTerm term="Composite">Score</JargonTerm>, value: signals.composite.value.toFixed(2) },
              { label: 'Agreement', value: `${signals.composite.agreementCount}/${signals.composite.agreementTotal}` },
            ]}
            copy={signals.composite.explanation}
            chartKind="zScore"
            onOpenChart={setDrawerKind}
          />
        </div>
      </ExpandableSection>
      <SignalDrawer coin={coin} signalKind={drawerKind} onClose={() => setDrawerKind(null)} />
    </section>
  )
}

interface MiniPanelProps {
  kicker: string
  title: string
  tone: 'green' | 'yellow' | 'red'
  rows: Array<{ label: React.ReactNode; value: string }>
  copy: string
  chartKind?: SignalSeriesKind
  onOpenChart?: (kind: SignalSeriesKind | null) => void
  footerNote?: string
}

function MiniPanel({ kicker, title, tone, rows, copy, chartKind, onOpenChart, footerNote }: MiniPanelProps) {
  return (
    <section className="subpanel-shell">
      <div className="panel-kicker">{kicker}</div>
      <div className={`mini-panel-title ${tone === 'green' ? 'text-signal-green' : tone === 'yellow' ? 'text-signal-yellow' : 'text-signal-red'}`}>{title}</div>
      <div className="rail-rows">
        {rows.map((row, index) => (
          <div key={index} className="rail-row">
            <span>{row.label}</span>
            <span className="font-mono text-text-primary">{row.value}</span>
          </div>
        ))}
      </div>
      <p className="panel-copy">{copy}</p>
      {chartKind && onOpenChart ? (
        <button
          type="button"
          className="signal-link-button"
          onClick={() => onOpenChart(chartKind)}
        >
          See chart -&gt;
        </button>
      ) : footerNote ? (
        <div className="signal-link-note">{footerNote}</div>
      ) : null}
    </section>
  )
}

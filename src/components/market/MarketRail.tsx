import { useState } from 'react'
import { useStore } from '../../store'
import { useEntryDecision } from '../../hooks/useEntryDecision'
import { usePositionRisk } from '../../hooks/usePositionRisk'
import { useSuggestedPosition } from '../../hooks/useSuggestedPosition'
import { useSignals } from '../../hooks/useSignals'
import { formatFundingRate, formatPercent, formatCompact, timeAgo } from '../../utils/format'
import { getMarketWorkflowGuidance, getWorkflowStepStates } from '../../utils/workflowGuidance'
import { classifyFearGreed, classifyBtcDominance, classifyFundingDivergence, classifyOiDivergence } from '../../utils/contextGuidance'
import { formatContextFreshness } from '../../utils/contextFreshness'
import type { SignalSeriesKind } from '../../utils/provenance'
import { ExpandableSection } from '../shared/ExpandableSection'
import { JargonTerm } from '../shared/JargonTerm'
import { StepLabel } from '../methodology/StepLabel'
import { SignalDrawer } from '../shared/SignalDrawer'

const toneClasses = {
  green: 'text-signal-green',
  yellow: 'text-signal-yellow',
  red: 'text-signal-red',
} as const

export function MarketRail() {
  const coin = useStore((s) => s.selectedCoin)
  const { signals, isWarmingUp, warmupProgress } = useSignals(coin)
  const decision = useEntryDecision(coin)
  const { outputs, riskStatus } = usePositionRisk()
  const composition = useSuggestedPosition(coin)
  const guidance = getMarketWorkflowGuidance(signals)
  const [step1] = getWorkflowStepStates(signals, decision, outputs, riskStatus, composition)
  const [drawerKind, setDrawerKind] = useState<SignalSeriesKind | null>(null)
  const fearGreed = useStore((s) => s.fearGreed)
  const cryptoMacro = useStore((s) => s.cryptoMacro)
  const binanceContext = useStore((s) => s.binanceContext)

  if (!signals) {
    return (
      <section className="panel-shell workflow-card workflow-card--yellow workflow-card--wait workflow-card--current">
        <StepLabel step={1} tone="yellow" state="wait" access="current" isCurrentFocus />
        <div className="panel-kicker">Step 1</div>
        <h2 className="panel-title">Can I trade this market?</h2>
        <div className="loading-block h-24" />
      </section>
    )
  }

  return (
    <section
      className={[
        'panel-shell',
        'workflow-card',
        `workflow-card--${step1.tone}`,
        `workflow-card--${step1.state}`,
        `workflow-card--${step1.access}`,
        step1.isCurrentFocus ? 'workflow-card--pulse' : '',
      ].join(' ')}
    >
      <StepLabel
        step={1}
        tone={step1.tone}
        state={step1.state}
        access={step1.access}
        isCurrentFocus={step1.isCurrentFocus}
      />
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
            <div className={`mini-panel-title ${toneClasses[signals.hurst.color]}`}>
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

        <ContextPanels
          fearGreed={fearGreed}
          cryptoMacro={cryptoMacro}
          binanceContext={binanceContext}
          coin={coin}
        />
      </ExpandableSection>
      <SignalDrawer coin={coin} signalKind={drawerKind} onClose={() => setDrawerKind(null)} />
    </section>
  )
}

// ── External Context Panels ──────────────────────────────────────────

import type { FearGreedSnapshot, CryptoMacroSnapshot, BinanceContextSnapshot } from '../../types/context'
import type { TrackedCoin } from '../../types/market'

interface ContextPanelsProps {
  fearGreed: FearGreedSnapshot
  cryptoMacro: CryptoMacroSnapshot
  binanceContext: BinanceContextSnapshot
  coin: TrackedCoin
}

function ContextPanels({ fearGreed, cryptoMacro, binanceContext, coin }: ContextPanelsProps) {
  const fg = classifyFearGreed(fearGreed.value)
  const btcDom = classifyBtcDominance(cryptoMacro.btcDominance, cryptoMacro.altSeasonBias)
  const fundingDiv = classifyFundingDivergence(binanceContext.fundingVsHyperliquid[coin])
  const oiDiv = classifyOiDivergence(binanceContext.oiVsHyperliquid[coin])

  const hasBinance = binanceContext.fundingRate[coin] !== null
  const fearGreedFooter = `Alternative.me Fear & Greed | ${formatContextFreshness(fearGreed.timestamp, 30 * 60 * 1000)}`
  const macroFooter = `CoinGecko Global | ${formatContextFreshness(cryptoMacro.timestamp, 10 * 60 * 1000)}`
  const binanceFooter = `Binance Futures | ${formatContextFreshness(binanceContext.timestamp, 5 * 60 * 1000)}`

  return (
    <div className="context-panels">
      <div className="context-panels__label">External Context</div>
      <div className="market-rail-grid">
        <MiniPanel
          kicker="Sentiment"
          title={fg.label}
          tone={fg.tone}
          rows={[
            { label: 'Index', value: fearGreed.value !== null ? String(fearGreed.value) : '--' },
            { label: 'State', value: fearGreed.classification ?? '--' },
          ]}
          copy={fg.explanation}
          footerNote={fearGreedFooter}
        />

        <MiniPanel
          kicker="Crypto Macro"
          title={btcDom.label}
          tone={btcDom.tone}
          rows={[
            { label: 'BTC Dom', value: cryptoMacro.btcDominance !== null ? `${cryptoMacro.btcDominance.toFixed(1)}%` : '--' },
            { label: '24h Mkt Cap', value: cryptoMacro.marketCapChange24h !== null ? formatPercent(cryptoMacro.marketCapChange24h, 2) : '--' },
            { label: 'Total Vol', value: cryptoMacro.totalVolumeUsd !== null ? `$${formatCompact(cryptoMacro.totalVolumeUsd)}` : '--' },
          ]}
          copy={btcDom.explanation}
          footerNote={macroFooter}
        />

        {hasBinance ? (
          <MiniPanel
            kicker="Binance Cross-Check"
            title={fundingDiv.label}
            tone={fundingDiv.tone}
            rows={[
              { label: 'Bin. Funding', value: binanceContext.fundingRate[coin] !== null ? formatFundingRate(binanceContext.fundingRate[coin]!) : '--' },
              { label: 'Funding vs HL', value: fundingDiv.label },
              { label: 'Bin. OI', value: binanceContext.openInterestUsd[coin] !== null ? `$${formatCompact(binanceContext.openInterestUsd[coin]!)}` : '--' },
              { label: 'OI vs HL', value: oiDiv.label },
            ]}
            copy={fundingDiv.explanation}
            footerNote={binanceFooter}
          />
        ) : (
          <MiniPanel
            kicker="Binance Cross-Check"
            title="Not available"
            tone="yellow"
            rows={[]}
            copy={`${coin} is not listed on Binance Futures. Cross-exchange comparison is unavailable for this asset.`}
            footerNote={binanceFooter}
          />
        )}
      </div>
    </div>
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
      <div className={`mini-panel-title ${toneClasses[tone]}`}>{title}</div>
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

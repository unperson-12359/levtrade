import { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useHistoricalSetupReview } from '../../hooks/useHistoricalSetupReview'
import type { TrackedCoin } from '../../types/market'
import type { SuggestedSetup, TrackedSetup } from '../../types/setup'
import { formatLeverage, formatPrice, formatUSD, timeAgo } from '../../utils/format'
import { formatSetupOutcomeTimestamp, getPendingOutcomeDisplay } from '../../utils/setupOutcomeFormat'
import { formatConfidenceTier, formatEntryQuality, formatTradeGrade } from '../../utils/setupFormat'
import {
  getSignalProvenance,
  type SignalSeriesKind,
} from '../../utils/provenance'
import { useStore } from '../../store'
import { PriceChart } from '../chart/PriceChart'
import { VerificationChart } from './VerificationChart'

export type SignalDrawerKind = SignalSeriesKind | 'setup'

interface SignalDrawerProps {
  coin: TrackedCoin
  signalKind: SignalDrawerKind | null
  setup?: SuggestedSetup | null
  trackedSetup?: TrackedSetup | null
  onClose: () => void
}

export function SignalDrawer({ coin, signalKind, setup, trackedSetup, onClose }: SignalDrawerProps) {
  const interval = useStore((s) => s.selectedInterval)
  const provenance = getSignalProvenance(interval)
  const drawerRef = useRef<HTMLElement>(null)
  const activeSetup = trackedSetup?.setup ?? setup ?? null
  const chartCoin = activeSetup?.coin ?? coin
  const isSetup = signalKind === 'setup'
  const isHistoricalSetup = isSetup && Boolean(trackedSetup)
  const showRail = signalKind !== 'setup' || Boolean(activeSetup)
  const historicalReview = useHistoricalSetupReview(isHistoricalSetup ? (trackedSetup ?? null) : null)

  useEffect(() => {
    if (!signalKind) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, signalKind])

  useEffect(() => {
    if (signalKind && drawerRef.current) {
      drawerRef.current.focus()
    }
  }, [signalKind])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key !== 'Tab' || !drawerRef.current) return
      const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0] as HTMLElement | undefined
      const last = focusable[focusable.length - 1] as HTMLElement | undefined
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    },
    [],
  )

  if (!signalKind) return null

  const title = getTitle(signalKind, isHistoricalSetup)
  const description = getDescription(signalKind, isHistoricalSetup, provenance)
  const inspectionNote = signalKind === 'setup' ? null : getInspectionNote(signalKind)
  const historicalSummaryCopy =
    activeSetup && isHistoricalSetup
      ? `This chart shows the original trigger context and the candle path from ${formatSetupOutcomeTimestamp(activeSetup.generatedAt)} through the latest available 1h candles. Use it to compare where the setup fired versus where price is now.`
      : null

  return createPortal(
    <>
      <div className="signal-drawer__backdrop" onClick={onClose} />
      <section
        ref={drawerRef}
        className="signal-drawer signal-drawer--open"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={handleKeyDown}
      >
        <div className="signal-drawer__frame">
          <div className="signal-drawer__header">
            <div className="signal-drawer__header-copy">
              <span className="panel-kicker">{isHistoricalSetup ? 'Setup Autopsy' : 'Verification Workspace'}</span>
              <h3 className="signal-drawer__title">{title}</h3>
              <p className="signal-drawer__subtitle">{description}</p>
            </div>
            <button className="signal-drawer__close" onClick={onClose} aria-label="Close">
              {'\u00D7'}
            </button>
          </div>

          <div className={`signal-drawer__content${showRail ? '' : ' signal-drawer__content--single'}`}>
            {isSetup ? (
              <>
                <div className="signal-drawer__main">
                  {isHistoricalSetup && !historicalReview.candles && historicalReview.loading ? (
                    <section className="signal-drawer__section">
                      <div className="signal-drawer__section-title">Loading review chart</div>
                      <div className="loading-block h-48" />
                      <p className="signal-drawer__copy">
                        Loading the 1h candle path from before the suggestion through the latest available data.
                      </p>
                    </section>
                  ) : isHistoricalSetup && historicalReview.error ? (
                    <section className="signal-drawer__section">
                      <div className="signal-drawer__section-title">Historical chart unavailable</div>
                      <p className="signal-drawer__copy">
                        {historicalReview.error}
                      </p>
                    </section>
                  ) : (
                    <PriceChart
                      coin={chartCoin}
                      embedded
                      showHeader={false}
                      verificationSetup={activeSetup ?? undefined}
                      chartCandles={isHistoricalSetup ? historicalReview.candles : null}
                      reviewMode={isHistoricalSetup ? 'historical' : 'live'}
                    />
                  )}
                  {activeSetup ? (
                    <section className="signal-drawer__section">
                      <div className="signal-drawer__section-title">
                        {isHistoricalSetup ? 'Stored snapshot' : 'Current setup context'}
                      </div>
                      <p className="signal-drawer__copy">
                        {isHistoricalSetup
                          ? historicalSummaryCopy
                          : 'This is the live setup the dashboard would act on right now, using the same chart context, geometry, and trade levels shown in the main workflow.'}
                      </p>
                      <p className="signal-drawer__copy">{activeSetup.summary}</p>
                    </section>
                  ) : (
                    <section className="signal-drawer__section">
                      <div className="signal-drawer__section-title">No actionable setup</div>
                      <p className="signal-drawer__copy">No actionable setup is available to verify right now.</p>
                    </section>
                  )}
                </div>

                {activeSetup && (
                  <aside className="signal-drawer__rail">
                    <section className="signal-drawer__section">
                      <div className="signal-drawer__section-title">
                        {isHistoricalSetup ? 'Snapshot' : 'Current context'}
                      </div>
                      <div className="signal-drawer__kv-grid signal-drawer__kv-grid--dense">
                        <MetaItem label="Direction" value={activeSetup.direction.toUpperCase()} />
                        <MetaItem label="Trade grade" value={formatTradeGrade(activeSetup.tradeGrade)} />
                        <MetaItem label="Confidence tier" value={formatConfidenceTier(activeSetup.confidenceTier)} />
                        <MetaItem label="Entry quality" value={formatEntryQuality(activeSetup.entryQuality)} />
                        <MetaItem label="Generated" value={formatTimestamp(activeSetup.generatedAt)} />
                        <MetaItem label="Age" value={timeAgo(activeSetup.generatedAt)} />
                        {activeSetup.source && <MetaItem label="Source" value={activeSetup.source.toUpperCase()} />}
                        {trackedSetup?.coverageStatus && <MetaItem label="Coverage" value={trackedSetup.coverageStatus.toUpperCase()} />}
                      </div>
                    </section>

                    <section className="signal-drawer__section">
                      <div className="signal-drawer__section-title">Trade levels</div>
                      <div className="signal-drawer__kv-grid signal-drawer__kv-grid--tri">
                        <MetaItem label="Entry" value={formatPrice(activeSetup.entryPrice, coin)} />
                        <MetaItem label="Stop" value={formatPrice(activeSetup.stopPrice, coin)} />
                        <MetaItem label="Target" value={formatPrice(activeSetup.targetPrice, coin)} />
                        <MetaItem label="Mean target" value={formatPrice(activeSetup.meanReversionTarget, coin)} />
                        <MetaItem label="Leverage" value={formatLeverage(activeSetup.suggestedLeverage)} />
                        <MetaItem label="Position size" value={formatUSD(activeSetup.suggestedPositionSize)} />
                      </div>
                    </section>

                    {trackedSetup ? (
                      <section className="signal-drawer__section">
                        <div className="signal-drawer__section-title">Resolution</div>
                        <div className="signal-drawer__outcome-grid">
                          <OutcomeCard trackedSetup={trackedSetup} window="4h" />
                          <OutcomeCard trackedSetup={trackedSetup} window="24h" />
                          <OutcomeCard trackedSetup={trackedSetup} window="72h" />
                        </div>
                      </section>
                    ) : (
                      <section className="signal-drawer__section">
                        <div className="signal-drawer__section-title">Provenance</div>
                        <p className="signal-drawer__copy">
                          Source: derived from current decision state, entry geometry, composite signal, and
                          `computeRisk()` suggestions using Hyperliquid hourly candles and live price.
                        </p>
                      </section>
                    )}
                  </aside>
                )}
              </>
            ) : (
              <>
                <div className="signal-drawer__main">
                  <VerificationChart coin={coin} kind={signalKind} height={440} />
                  <section className="signal-drawer__section">
                    <div className="signal-drawer__section-title">Indicator interpretation</div>
                    <p className="signal-drawer__copy">{description}</p>
                    <p className="signal-drawer__copy">
                      Use this full-screen view to inspect how the live series is behaving, not just the latest pill value.
                    </p>
                  </section>
                </div>

                <aside className="signal-drawer__rail">
                  <section className="signal-drawer__section">
                    <div className="signal-drawer__section-title">Data provenance</div>
                    <div className="signal-drawer__kv-grid">
                      <MetaItem label="Source" value={provenance[signalKind].source} />
                      <MetaItem label="Request type" value={provenance[signalKind].requestType} />
                      <MetaItem label="Timeframe" value={provenance[signalKind].timeframe} />
                      <MetaItem label="Lookback" value={provenance[signalKind].lookback} />
                      <MetaItem label="Update cadence" value={provenance[signalKind].updateCadence} />
                    </div>
                  </section>

                  <section className="signal-drawer__section">
                    <div className="signal-drawer__section-title">What to inspect</div>
                    <p className="signal-drawer__copy">{inspectionNote}</p>
                  </section>
                </aside>
              </>
            )}
          </div>
        </div>
      </section>
    </>,
    document.body,
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="signal-drawer__meta-item">
      <span className="stat-label">{label}</span>
      <span className="signal-drawer__meta-value">{value}</span>
    </div>
  )
}

function OutcomeCard({
  trackedSetup,
  window,
}: {
  trackedSetup: TrackedSetup
  window: '4h' | '24h' | '72h'
}) {
  const outcome = trackedSetup.outcomes[window]
  const pending = outcome.result === 'pending' ? getPendingOutcomeDisplay(trackedSetup.setup.generatedAt, window) : null
  const resultTone =
    outcome.result === 'win'
      ? 'text-signal-green'
      : outcome.result === 'loss' || outcome.result === 'unresolvable'
        ? 'text-signal-red'
        : 'text-signal-yellow'

  return (
    <div className="signal-drawer__meta-item">
      <span className="stat-label">{window} outcome</span>
      <span className={`stat-value ${resultTone}`}>{pending ? pending.label : outcome.result.toUpperCase()}</span>
      <div className="signal-drawer__meta-copy">
        {pending
          ? pending.note
          : [
              outcome.rAchieved !== null ? `${outcome.rAchieved >= 0 ? '+' : ''}${outcome.rAchieved.toFixed(1)}R` : null,
              outcome.resolutionReason ?? null,
              outcome.coverageStatus ?? null,
            ]
              .filter(Boolean)
              .join(' | ')}
      </div>
      {outcome.resolvedAt && <div className="signal-drawer__source-note">Resolved {formatTimestamp(outcome.resolvedAt)}</div>}
    </div>
  )
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getTitle(signalKind: SignalDrawerKind, isHistoricalSetup: boolean): string {
  if (signalKind === 'setup') {
    return isHistoricalSetup ? 'Tracked Setup Autopsy' : 'Live Setup Verification'
  }
  if (signalKind === 'hurst') return 'Market Verification'
  if (signalKind === 'fundingRate') return 'Funding Verification'
  if (signalKind === 'atr') return 'Volatility Verification'
  if (signalKind === 'distanceFromMean' || signalKind === 'stretchZ') return 'Entry Geometry Verification'
  return 'Signal Verification'
}

function getDescription(
  signalKind: SignalDrawerKind,
  isHistoricalSetup: boolean,
  provenance: ReturnType<typeof getSignalProvenance>,
): string {
  if (signalKind === 'setup') {
    return isHistoricalSetup
      ? 'Stored snapshot from when the dashboard suggested the trade. Use this workspace to run a full post-mortem on the levels, timing, and resolved outcome windows.'
      : 'Current suggested setup with full chart context, trade geometry, and the same generated levels the dashboard is surfacing right now.'
  }
  return provenance[signalKind].description
}

function getInspectionNote(signalKind: SignalSeriesKind): string {
  switch (signalKind) {
    case 'hurst':
      return 'Check whether the line stays above or below the regime thresholds or just chops around neutral. Durable moves matter more than one isolated print.'
    case 'fundingRate':
      return 'Look for crowding extremes and whether funding is reverting or staying pinned. Persistent extremes usually matter more than a single hourly spike.'
    case 'atr':
      return 'Check whether volatility is expanding or compressing before trusting stop distance. Spiking ATR often changes the quality of the setup.'
    case 'distanceFromMean':
      return 'Check whether price is genuinely displaced from the 20-period mean or already reverting back toward it. The more displacement, the more reversion fuel remains.'
    case 'stretchZ':
      return 'Check whether the stretch is statistically unusual enough to justify the entry geometry instead of chasing a move that is already normalizing.'
    case 'zScore':
      return 'Check how often the series pushes beyond the stretch thresholds and whether extremes actually mean-revert or keep trending through them.'
  }
}

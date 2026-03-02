import { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { TrackedCoin } from '../../types/market'
import type { SuggestedSetup, TrackedSetup } from '../../types/setup'
import { formatLeverage, formatPrice, formatUSD, timeAgo } from '../../utils/format'
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
  const drawerRef = useRef<HTMLDivElement>(null)
  const activeSetup = trackedSetup?.setup ?? setup ?? null
  const isHistoricalSetup = signalKind === 'setup' && Boolean(trackedSetup)

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

  const title =
    signalKind === 'setup'
      ? isHistoricalSetup
        ? 'Tracked Setup Verification'
        : 'Suggested Setup Verification'
      : provenance[signalKind].title
  const description =
    signalKind === 'setup'
      ? isHistoricalSetup
        ? 'This view shows the stored setup snapshot from when the dashboard suggested the trade, along with how each scoring window resolved.'
        : 'This view shows the current suggested setup, its generated levels, and the market context used to propose it.'
      : provenance[signalKind].description

  return createPortal(
    <>
      <div className="signal-drawer__backdrop" onClick={onClose} />
      <div
        ref={drawerRef}
        className="signal-drawer signal-drawer--open"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={handleKeyDown}
      >
        <div className="signal-drawer__header">
          <div>
            <span className="panel-kicker">Signal Verification</span>
            <h3 className="signal-drawer__title">{title}</h3>
          </div>
          <button className="signal-drawer__close" onClick={onClose} aria-label="Close">
            {'\u00D7'}
          </button>
        </div>

        {signalKind === 'setup' ? (
          <>
            <PriceChart coin={coin} embedded showHeader={false} verificationSetup={activeSetup ?? undefined} />
            {activeSetup ? (
              <div className="signal-drawer__provenance">
                <div className="signal-drawer__meta-grid">
                  <MetaItem label="Direction" value={activeSetup.direction.toUpperCase()} />
                  <MetaItem label="Entry" value={formatPrice(activeSetup.entryPrice, coin)} />
                  <MetaItem label="Stop" value={formatPrice(activeSetup.stopPrice, coin)} />
                  <MetaItem label="Target" value={formatPrice(activeSetup.targetPrice, coin)} />
                  <MetaItem label="Mean target" value={formatPrice(activeSetup.meanReversionTarget, coin)} />
                  <MetaItem label="Leverage" value={formatLeverage(activeSetup.suggestedLeverage)} />
                  <MetaItem label="Position size" value={formatUSD(activeSetup.suggestedPositionSize)} />
                  <MetaItem label="Generated" value={formatTimestamp(activeSetup.generatedAt)} />
                  <MetaItem label="Age" value={timeAgo(activeSetup.generatedAt)} />
                  <MetaItem label="Confidence tier" value={activeSetup.confidenceTier.toUpperCase()} />
                  <MetaItem label="Entry quality" value={activeSetup.entryQuality.toUpperCase()} />
                  {activeSetup.source && <MetaItem label="Source" value={activeSetup.source.toUpperCase()} />}
                  {trackedSetup?.coverageStatus && <MetaItem label="Coverage" value={trackedSetup.coverageStatus.toUpperCase()} />}
                </div>
                <p className="panel-copy">{activeSetup.summary}</p>
                <p className="panel-copy">{description}</p>
                {trackedSetup ? (
                  <div className="signal-drawer__outcome-grid">
                    <OutcomeCard trackedSetup={trackedSetup} window="4h" />
                    <OutcomeCard trackedSetup={trackedSetup} window="24h" />
                    <OutcomeCard trackedSetup={trackedSetup} window="72h" />
                  </div>
                ) : (
                  <p className="panel-copy signal-drawer__source-note">
                    Source: derived from current decision state, entry geometry, composite signal, and `computeRisk()` suggestions using Hyperliquid hourly candles and live price.
                  </p>
                )}
              </div>
            ) : (
              <p className="panel-copy">No actionable setup is available to verify right now.</p>
            )}
          </>
        ) : (
          <>
            <VerificationChart coin={coin} kind={signalKind} height={240} />
            <div className="signal-drawer__provenance">
              <p className="panel-copy">{description}</p>
              <div className="signal-drawer__meta-grid">
                <MetaItem label="Source" value={provenance[signalKind].source} />
                <MetaItem label="Request type" value={provenance[signalKind].requestType} />
                <MetaItem label="Timeframe" value={provenance[signalKind].timeframe} />
                <MetaItem label="Lookback" value={provenance[signalKind].lookback} />
                <MetaItem label="Update cadence" value={provenance[signalKind].updateCadence} />
              </div>
            </div>
          </>
        )}
      </div>
    </>,
    document.body,
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="signal-drawer__meta-item">
      <span className="stat-label">{label}</span>
      <span className="panel-copy">{value}</span>
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
  const resultTone =
    outcome.result === 'win'
      ? 'text-signal-green'
      : outcome.result === 'loss' || outcome.result === 'unresolvable'
        ? 'text-signal-red'
        : 'text-signal-yellow'

  return (
    <div className="signal-drawer__meta-item">
      <span className="stat-label">{window} outcome</span>
      <span className={`stat-value ${resultTone}`}>{outcome.result.toUpperCase()}</span>
      <div className="panel-copy">
        {[
          outcome.rAchieved !== null ? `${outcome.rAchieved >= 0 ? '+' : ''}${outcome.rAchieved.toFixed(1)}R` : null,
          outcome.resolutionReason ?? null,
          outcome.coverageStatus ?? null,
        ]
          .filter(Boolean)
          .join(' | ') || 'Pending'}
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

import { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { TrackedCoin } from '../../types/market'
import type { SuggestedSetup } from '../../types/setup'
import { formatLeverage, formatPrice, formatUSD, timeAgo } from '../../utils/format'
import {
  SIGNAL_PROVENANCE,
  type SignalSeriesKind,
} from '../../utils/provenance'
import { PriceChart } from '../chart/PriceChart'
import { VerificationChart } from './VerificationChart'

export type SignalDrawerKind = SignalSeriesKind | 'setup'

interface SignalDrawerProps {
  coin: TrackedCoin
  signalKind: SignalDrawerKind | null
  setup?: SuggestedSetup | null
  onClose: () => void
}

export function SignalDrawer({ coin, signalKind, setup, onClose }: SignalDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)

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

  const title = signalKind === 'setup' ? 'Suggested Setup Verification' : SIGNAL_PROVENANCE[signalKind].title
  const description =
    signalKind === 'setup'
      ? 'This view shows the current suggested setup, its generated levels, and the market context used to propose it.'
      : SIGNAL_PROVENANCE[signalKind].description

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
            <PriceChart coin={coin} embedded showHeader={false} verificationSetup={setup ?? undefined} />
            {setup ? (
              <div className="signal-drawer__provenance">
                <div className="signal-drawer__meta-grid">
                  <MetaItem label="Direction" value={setup.direction.toUpperCase()} />
                  <MetaItem label="Entry" value={formatPrice(setup.entryPrice, coin)} />
                  <MetaItem label="Stop" value={formatPrice(setup.stopPrice, coin)} />
                  <MetaItem label="Target" value={formatPrice(setup.targetPrice, coin)} />
                  <MetaItem label="Mean target" value={formatPrice(setup.meanReversionTarget, coin)} />
                  <MetaItem label="Leverage" value={formatLeverage(setup.suggestedLeverage)} />
                  <MetaItem label="Position size" value={formatUSD(setup.suggestedPositionSize)} />
                  <MetaItem label="Generated" value={timeAgo(setup.generatedAt)} />
                </div>
                <p className="panel-copy">{setup.summary}</p>
                <p className="panel-copy signal-drawer__source-note">
                  Source: derived from current decision state, entry geometry, composite signal, and `computeRisk()` suggestions using Hyperliquid hourly candles and live price.
                </p>
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
                <MetaItem label="Source" value={SIGNAL_PROVENANCE[signalKind].source} />
                <MetaItem label="Request type" value={SIGNAL_PROVENANCE[signalKind].requestType} />
                <MetaItem label="Timeframe" value={SIGNAL_PROVENANCE[signalKind].timeframe} />
                <MetaItem label="Lookback" value={SIGNAL_PROVENANCE[signalKind].lookback} />
                <MetaItem label="Update cadence" value={SIGNAL_PROVENANCE[signalKind].updateCadence} />
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

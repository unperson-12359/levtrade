import { useState } from 'react'
import { useStore } from '../../store'
import { useSignals } from '../../hooks/useSignals'
import type { SignalSeriesKind } from '../../utils/provenance'
import { JargonTerm } from '../shared/JargonTerm'
import { SignalDrawer } from '../shared/SignalDrawer'
import { formatEntryQuality } from '../../utils/setupFormat'

const meterToneClasses = {
  green: 'bg-signal-green',
  yellow: 'bg-signal-yellow',
  red: 'bg-signal-red',
} as const

const textToneClasses = {
  green: 'text-signal-green',
  yellow: 'text-signal-yellow',
  red: 'text-signal-red',
} as const

interface EntryGeometryPanelProps {
  embedded?: boolean
  mode?: 'default' | 'compactKpi'
}

export function EntryGeometryPanel({ embedded = false, mode = 'default' }: EntryGeometryPanelProps) {
  const coin = useStore((s) => s.selectedCoin)
  const { signals } = useSignals(coin)
  const [drawerKind, setDrawerKind] = useState<SignalSeriesKind | null>(null)

  if (!signals) {
    return (
      <section className={embedded ? 'subpanel-shell' : 'panel-shell'}>
        <div className="panel-kicker">Entry Geometry</div>
        <div className="loading-block h-32" />
      </section>
    )
  }

  const entry = signals.entryGeometry

  if (mode === 'compactKpi') {
    return (
      <>
        <div className="step2-kpi-row step2-kpi-row--geometry">
          <Stat
            label="Distance"
            value={`${entry.distanceFromMeanPct.toFixed(2)}%`}
            tone={entry.color}
            onActivate={() => setDrawerKind('distanceFromMean')}
            compact
          />
          <Stat
            label={<JargonTerm term="Stretch" />}
            value={`${entry.stretchZEquivalent.toFixed(2)}\u03C3`}
            tone={entry.color}
            onActivate={() => setDrawerKind('stretchZ')}
            compact
          />
          <Stat
            label={<JargonTerm term="ATR">ATR Dislocation</JargonTerm>}
            value={`${entry.atrDislocation.toFixed(2)}x`}
            tone={entry.color}
            onActivate={() => setDrawerKind('atr')}
            compact
          />
          <Stat label="Bias" value={entry.directionBias.toUpperCase()} tone={entry.color} compact />
        </div>
        <SignalDrawer coin={coin} signalKind={drawerKind} onClose={() => setDrawerKind(null)} />
      </>
    )
  }

  return (
    <section className={embedded ? 'subpanel-shell' : 'panel-shell'}>
      <div className="panel-header">
        <div>
          <div className="panel-kicker">Entry Geometry</div>
          <h3 className="panel-title">Stretch and bounce setup</h3>
        </div>
        <span className={`status-pill status-pill--${entry.color}`}>
          {formatEntryQuality(entry.entryQuality)}
        </span>
      </div>

      <div className="stat-grid">
        <Stat
          label="Distance From Mean"
          value={`${entry.distanceFromMeanPct.toFixed(2)}%`}
          tone={entry.color}
          onActivate={() => setDrawerKind('distanceFromMean')}
        />
        <Stat
          label={<JargonTerm term="Stretch" />}
          value={`${entry.stretchZEquivalent.toFixed(2)}\u03C3`}
          tone={entry.color}
          onActivate={() => setDrawerKind('stretchZ')}
        />
        <Stat
          label={<JargonTerm term="ATR">ATR Dislocation</JargonTerm>}
          value={`${entry.atrDislocation.toFixed(2)}x`}
          tone={entry.color}
          onActivate={() => setDrawerKind('atr')}
        />
        <Stat label="Bias" value={entry.directionBias.toUpperCase()} tone={entry.color} />
      </div>

      <div className="meter-block">
        <div>
          <div className="meter-label"><JargonTerm term="Reversion Potential" /></div>
          <div className="meter-bar">
            <div
              className={`meter-fill ${meterToneClasses[entry.color]}`}
              style={{ width: `${entry.reversionPotential * 100}%` }}
            />
          </div>
        </div>
        <div>
          <div className="meter-label"><JargonTerm term="Chase Risk" /></div>
          <div className="meter-bar">
            <div
              className="meter-fill bg-signal-red"
              style={{ width: `${entry.chaseRisk * 100}%` }}
            />
          </div>
        </div>
      </div>

      <p className="panel-copy">{entry.explanation}</p>
      <SignalDrawer coin={coin} signalKind={drawerKind} onClose={() => setDrawerKind(null)} />
    </section>
  )
}

interface StatProps {
  label: React.ReactNode
  value: string
  tone: 'green' | 'yellow' | 'red'
  onActivate?: () => void
  compact?: boolean
}

function Stat({ label, value, tone, onActivate, compact = false }: StatProps) {
  const baseClass = compact ? 'step2-kpi-card' : 'stat-card'
  const clickableClass = compact ? 'step2-kpi-card--clickable' : 'stat-card--clickable'
  const interactiveProps = onActivate
    ? {
        className: `${baseClass} ${clickableClass}`,
        role: 'button' as const,
        tabIndex: 0,
        onClick: onActivate,
        onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onActivate()
          }
        },
      }
    : {
        className: baseClass,
      }

  return (
    <div {...interactiveProps}>
      <div className={compact ? 'step2-kpi-card__label' : 'stat-label'}>{label}</div>
      <div className={`${compact ? 'step2-kpi-card__value' : 'stat-value'} ${textToneClasses[tone]}`}>{value}</div>
      {compact && (
        <div className="step2-kpi-card__hint">
          {onActivate ? 'Tap for chart' : 'Live geometry'}
        </div>
      )}
    </div>
  )
}

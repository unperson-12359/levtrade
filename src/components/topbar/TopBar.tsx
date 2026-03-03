import { useMemo } from 'react'
import { TRACKED_COINS, type TrackedCoin } from '../../types/market'
import { useStore } from '../../store'
import { AssetPill } from './AssetPill'
import { ConnectionIndicator } from './ConnectionIndicator'

export function TopBar() {
  const toggle = useStore((s) => s.toggleSection)
  const signals = useStore((s) => s.signals)

  const bestCoin = useMemo(() => {
    let best: TrackedCoin | null = null
    let bestScore = 0
    for (const coin of TRACKED_COINS) {
      const sig = signals[coin]
      if (!sig || sig.isStale || sig.isWarmingUp) continue
      const dir = sig.composite.direction
      if (dir !== 'long' && dir !== 'short') continue
      const score = Math.abs(sig.composite.value)
      if (score > bestScore) {
        bestScore = score
        best = coin
      }
    }
    return best
  }, [signals])

  return (
    <header className="topbar-shell">
      <div className="topbar-shell__inner">
        <button
          type="button"
          className="topbar-hamburger"
          onClick={() => toggle('menu')}
          aria-label="Open menu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <span className="topbar-brand__name">LevTrade</span>

        <div className="topbar-assets scrollbar-hide">
          {TRACKED_COINS.map((coin) => (
            <AssetPill key={coin} coin={coin} isBest={coin === bestCoin} />
          ))}
        </div>

        <ConnectionIndicator />
        <span className="topbar-sync-dot topbar-sync-dot--green" title="History: server-backed collector + local browser cache" />
      </div>
    </header>
  )
}

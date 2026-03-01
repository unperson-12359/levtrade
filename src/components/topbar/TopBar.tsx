import { TRACKED_COINS } from '../../types/market'
import { useStore } from '../../store'
import { timeAgo } from '../../utils/format'
import { AssetPill } from './AssetPill'
import { ConnectionIndicator } from './ConnectionIndicator'

export function TopBar() {
  const lastUpdate = useStore((s) => s.lastUpdate)

  return (
    <header className="topbar-shell">
      <div className="topbar-shell__inner">
        <div className="topbar-brand">
          <div className="panel-kicker">Hyperliquid Entry Cockpit</div>
          <div className="text-xl font-semibold tracking-tight text-text-primary">LevTrade</div>
        </div>

        <div className="topbar-assets scrollbar-hide">
          {TRACKED_COINS.map((coin) => (
            <AssetPill key={coin} coin={coin} />
          ))}
        </div>

        <div className="topbar-status">
          <ConnectionIndicator />
          {lastUpdate && <span className="text-sm text-text-muted">{timeAgo(lastUpdate)}</span>}
        </div>
      </div>
    </header>
  )
}

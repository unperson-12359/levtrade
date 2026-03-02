import { TRACKED_COINS } from '../../types/market'
import { useStore } from '../../store'
import { AssetPill } from './AssetPill'
import { ConnectionIndicator } from './ConnectionIndicator'

export function TopBar() {
  const toggle = useStore((s) => s.toggleSection)
  const syncStatus = useStore((s) => s.syncStatus)
  const cloudSyncEnabled = useStore((s) => s.cloudSyncEnabled)

  const syncTone = !cloudSyncEnabled ? 'yellow'
    : syncStatus === 'synced' ? 'green'
    : syncStatus === 'error' || syncStatus === 'offline' ? 'red'
    : 'yellow'

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
            <AssetPill key={coin} coin={coin} />
          ))}
        </div>

        <ConnectionIndicator />
        <span className={`topbar-sync-dot topbar-sync-dot--${syncTone}`} title={`Sync: ${syncTone}`} />
      </div>
    </header>
  )
}

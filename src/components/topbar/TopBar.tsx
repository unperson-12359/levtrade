import { TRACKED_COINS } from '../../types/market'
import { AssetPill } from './AssetPill'
import { ConnectionIndicator } from './ConnectionIndicator'
import { useStore } from '../../store'
import { timeAgo } from '../../utils/format'

export function TopBar() {
  const lastUpdate = useStore((s) => s.lastUpdate)

  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-bg-primary/95 backdrop-blur-sm">
      <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-lg font-bold tracking-tight text-text-primary">LevTrade</span>
        </div>

        {/* Asset Pills */}
        <div className="flex items-center gap-2 flex-1 justify-center min-w-0 overflow-x-auto scrollbar-hide">
          {TRACKED_COINS.map((coin) => (
            <AssetPill key={coin} coin={coin} />
          ))}
        </div>

        {/* Status */}
        <div className="flex items-center gap-3 shrink-0">
          <ConnectionIndicator />
          {lastUpdate && (
            <span className="text-xs text-text-muted">{timeAgo(lastUpdate)}</span>
          )}
        </div>
      </div>
    </header>
  )
}

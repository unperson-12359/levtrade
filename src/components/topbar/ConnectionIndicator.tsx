import { useStore } from '../../store'

const statusConfig = {
  connected: { color: 'bg-signal-green', label: 'Connected' },
  connecting: { color: 'bg-signal-yellow animate-pulse', label: 'Connecting...' },
  disconnected: { color: 'bg-signal-red', label: 'Disconnected' },
  error: { color: 'bg-signal-red', label: 'Error' },
} as const

export function ConnectionIndicator() {
  const status = useStore((s) => s.connectionStatus)
  const config = statusConfig[status]

  return (
    <div className="flex items-center gap-1.5" title={config.label}>
      <span className={`w-2 h-2 rounded-full ${config.color}`} />
      <span className="text-sm text-text-muted hidden sm:inline">{config.label}</span>
    </div>
  )
}

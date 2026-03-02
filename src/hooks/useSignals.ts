import { useStore } from '../store'
import type { TrackedCoin } from '../types/market'
import { overallStatus, overallStatusColor } from '../utils/explanations'

export function useSignals(coin: TrackedCoin) {
  const signals = useStore((s) => s.signals[coin])

  const status = signals
    ? overallStatus(signals.hurst, signals.composite)
    : null
  const statusColor = status ? overallStatusColor(status) : 'yellow'

  return {
    signals,
    isReady: signals !== null && !signals.isWarmingUp,
    isWarmingUp: signals?.isWarmingUp ?? true,
    warmupProgress: signals?.warmupProgress ?? 0,
    overallStatus: status,
    overallStatusColor: statusColor,
    regimeColor: signals?.hurst.color ?? 'yellow' as const,
    signalColor: signals?.composite.color ?? 'yellow' as const,
  }
}

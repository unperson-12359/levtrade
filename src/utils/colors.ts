import type { SignalColor } from '../types/signals'

export const SIGNAL_COLORS: Record<SignalColor, string> = {
  green: 'var(--color-signal-green)',
  yellow: 'var(--color-signal-yellow)',
  red: 'var(--color-signal-red)',
}

export const SIGNAL_BG_COLORS: Record<SignalColor, string> = {
  green: 'var(--color-signal-green-bg)',
  yellow: 'var(--color-signal-yellow-bg)',
  red: 'var(--color-signal-red-bg)',
}

export const SIGNAL_TEXT_CLASSES: Record<SignalColor, string> = {
  green: 'text-signal-green',
  yellow: 'text-signal-yellow',
  red: 'text-signal-red',
}

export const SIGNAL_BG_CLASSES: Record<SignalColor, string> = {
  green: 'bg-signal-green/10',
  yellow: 'bg-signal-yellow/10',
  red: 'bg-signal-red/10',
}

export const SIGNAL_BORDER_CLASSES: Record<SignalColor, string> = {
  green: 'border-signal-green/20',
  yellow: 'border-signal-yellow/20',
  red: 'border-signal-red/20',
}

export function leverageColor(leverage: number): SignalColor {
  if (leverage <= 5) return 'green'
  if (leverage <= 15) return 'yellow'
  return 'red'
}

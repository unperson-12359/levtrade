import type { SignalColor } from '../../types/signals'
import { SIGNAL_COLORS } from '../../utils/colors'

interface TrafficLightProps {
  color: SignalColor
  size?: 'sm' | 'md' | 'lg'
  pulse?: boolean
  label?: string
}

const sizes = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
}

export function TrafficLight({ color, size = 'md', pulse = false, label }: TrafficLightProps) {
  return (
    <span
      className={`inline-block rounded-full ${sizes[size]} ${pulse ? 'animate-pulse' : ''}`}
      style={{ backgroundColor: SIGNAL_COLORS[color] }}
      title={label}
    />
  )
}

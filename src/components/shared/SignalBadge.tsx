import type { SignalColor } from '../../types/signals'
import { SIGNAL_TEXT_CLASSES, SIGNAL_BG_CLASSES, SIGNAL_BORDER_CLASSES } from '../../utils/colors'

interface SignalBadgeProps {
  label: string
  color: SignalColor
  size?: 'sm' | 'md'
}

export function SignalBadge({ label, color, size = 'md' }: SignalBadgeProps) {
  const padding = size === 'sm' ? 'px-3 py-1 text-sm' : 'px-4 py-1.5 text-base'

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${padding} ${SIGNAL_TEXT_CLASSES[color]} ${SIGNAL_BG_CLASSES[color]} ${SIGNAL_BORDER_CLASSES[color]}`}
    >
      {label}
    </span>
  )
}

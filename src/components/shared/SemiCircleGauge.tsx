import { SIGNAL_COLORS } from '../../utils/colors'
import type { SignalColor } from '../../types/signals'

interface SemiCircleGaugeProps {
  /** Current value */
  value: number
  /** Minimum of the scale */
  min: number
  /** Maximum of the scale */
  max: number
  /** Label below the gauge */
  label: string
  /** Secondary label / value text */
  subLabel?: string
  /** Color of the active arc + needle */
  color: SignalColor
  /** Diameter in px */
  size?: number
  /** Labels for the left and right extremes */
  leftLabel?: string
  rightLabel?: string
}

export function SemiCircleGauge({
  value,
  min,
  max,
  label,
  subLabel,
  color,
  size = 180,
  leftLabel,
  rightLabel,
}: SemiCircleGaugeProps) {
  const range = max - min
  const normalized = range > 0 ? Math.max(0, Math.min(1, (value - min) / range)) : 0.5

  // SVG geometry
  const cx = size / 2
  const cy = size / 2 + 10
  const r = size / 2 - 20
  const strokeWidth = 12

  // Arc angles: from 180deg (left) to 0deg (right) in standard math,
  // but in SVG we go from PI to 0
  const startAngle = Math.PI
  const endAngle = 0
  const needleAngle = startAngle - normalized * Math.PI

  // Background arc path (full semicircle)
  const bgPath = describeArc(cx, cy, r, startAngle, endAngle)

  // Active arc path (from start to needle position)
  const activePath = describeArc(cx, cy, r, startAngle, needleAngle)

  // Needle endpoint
  const needleR = r - 15
  const needleX = cx + needleR * Math.cos(needleAngle)
  const needleY = cy - needleR * Math.sin(needleAngle)

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
        {/* Background arc */}
        <path
          d={bgPath}
          fill="none"
          stroke="var(--color-border-subtle)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Active arc */}
        <path
          d={activePath}
          fill="none"
          stroke={SIGNAL_COLORS[color]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke={SIGNAL_COLORS[color]}
          strokeWidth={2.5}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
        {/* Center dot */}
        <circle cx={cx} cy={cy} r={4} fill={SIGNAL_COLORS[color]} />

        {/* Extreme labels */}
        {leftLabel && (
          <text x={12} y={cy + 16} fill="var(--color-text-muted)" fontSize={12} textAnchor="start">
            {leftLabel}
          </text>
        )}
        {rightLabel && (
          <text x={size - 12} y={cy + 16} fill="var(--color-text-muted)" fontSize={12} textAnchor="end">
            {rightLabel}
          </text>
        )}
      </svg>

      {/* Labels */}
      <div className="text-center -mt-2">
        <div className="text-base font-medium text-text-primary">{label}</div>
        {subLabel && (
          <div className="text-sm text-text-muted font-mono mt-0.5">{subLabel}</div>
        )}
      </div>
    </div>
  )
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const startX = cx + r * Math.cos(startAngle)
  const startY = cy - r * Math.sin(startAngle)
  const endX = cx + r * Math.cos(endAngle)
  const endY = cy - r * Math.sin(endAngle)
  const largeArc = Math.abs(startAngle - endAngle) > Math.PI ? 1 : 0
  // SVG arc: sweep clockwise when going from left to right
  return `M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`
}

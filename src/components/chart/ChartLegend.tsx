interface ChartLegendItem {
  label: string
  value: string
  tone?: 'default' | 'muted' | 'green' | 'yellow' | 'red'
}

interface ChartLegendProps {
  items: ChartLegendItem[]
}

const toneClasses: Record<NonNullable<ChartLegendItem['tone']>, string> = {
  default: 'text-text-primary',
  muted: 'text-text-muted',
  green: 'text-signal-green',
  yellow: 'text-signal-yellow',
  red: 'text-signal-red',
}

export function ChartLegend({ items }: ChartLegendProps) {
  return (
    <div className="chart-legend">
      {items.map((item) => (
        <div key={item.label} className="chart-legend__item">
          <span className="chart-legend__label">{item.label}</span>
          <span className={`chart-legend__value ${toneClasses[item.tone ?? 'default']}`}>{item.value}</span>
        </div>
      ))}
    </div>
  )
}

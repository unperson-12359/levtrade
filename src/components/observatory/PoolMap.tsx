import { useMemo } from 'react'
import type { CorrelationEdge, IndicatorCategory, IndicatorMetric } from '../../observatory/types'

interface PoolMapProps {
  indicators: IndicatorMetric[]
  edges: CorrelationEdge[]
  selectedId: string | null
  onSelect: (id: string) => void
  viewMode: 'basic' | 'advanced'
}

interface PositionedNode {
  metric: IndicatorMetric
  x: number
  y: number
}

const CATEGORY_ORDER: IndicatorCategory[] = [
  'Trend',
  'Momentum',
  'Volatility',
  'Volume',
  'Structure',
]

export function PoolMap({ indicators, edges, selectedId, onSelect, viewMode }: PoolMapProps) {
  const nodes = useMemo(() => positionNodes(indicators), [indicators])
  const nodeMap = useMemo(() => {
    const mapped = new Map<string, PositionedNode>()
    for (const node of nodes) {
      mapped.set(node.metric.id, node)
    }
    return mapped
  }, [nodes])

  const visibleEdges = useMemo(
    () =>
      edges
        .filter((edge) => nodeMap.has(edge.a) && nodeMap.has(edge.b))
        .slice(0, viewMode === 'advanced' ? 96 : 48),
    [edges, nodeMap, viewMode],
  )

  return (
    <div className="obs-pool-map" data-testid="obs-pool-map">
      <svg className="obs-pool-map__edges" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {visibleEdges.map((edge) => {
          const from = nodeMap.get(edge.a)
          const to = nodeMap.get(edge.b)
          if (!from || !to) return null
          const tone = (edge.pearson + edge.spearman) / 2
          return (
            <line
              key={`${edge.a}-${edge.b}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={tone >= 0 ? 'rgba(212, 168, 83, 0.45)' : 'rgba(200, 149, 110, 0.35)'}
              strokeWidth={Math.max(0.12, edge.strength * 0.35)}
              strokeDasharray={edge.lagBars === 0 ? undefined : '1.2 0.8'}
            />
          )
        })}
      </svg>

      {nodes.map((node) => {
        const selected = node.metric.id === selectedId
        const tone = nodeTone(node.metric.currentState)
        return (
          <button
            key={node.metric.id}
            type="button"
            className={`obs-pool-map__node ${selected ? 'obs-pool-map__node--selected' : ''}`}
            style={{ left: `${node.x}%`, top: `${node.y}%`, borderColor: tone }}
            onClick={() => onSelect(node.metric.id)}
            data-testid={`obs-indicator-node-${node.metric.id}`}
          >
            <span className="obs-pool-map__node-label">{shortLabel(node.metric.label)}</span>
          </button>
        )
      })}
    </div>
  )
}

function positionNodes(indicators: IndicatorMetric[]): PositionedNode[] {
  const grouped = new Map<IndicatorCategory, IndicatorMetric[]>()
  for (const category of CATEGORY_ORDER) {
    grouped.set(category, [])
  }

  for (const metric of indicators) {
    const existing = grouped.get(metric.category) ?? []
    existing.push(metric)
    grouped.set(metric.category, existing)
  }

  const positioned: PositionedNode[] = []
  for (let categoryIndex = 0; categoryIndex < CATEGORY_ORDER.length; categoryIndex += 1) {
    const category = CATEGORY_ORDER[categoryIndex]
    if (!category) continue
    const metrics = grouped.get(category) ?? []
    const sectorCenter = (Math.PI * 2 * categoryIndex) / CATEGORY_ORDER.length
    const spread = Math.PI / 4.2

    for (let index = 0; index < metrics.length; index += 1) {
      const metric = metrics[index]
      if (!metric) continue
      const rank = metrics.length <= 1 ? 0.5 : index / (metrics.length - 1)
      const angle = sectorCenter - spread / 2 + rank * spread
      const ringOffset = 24 + (index % 4) * 6 + Math.floor(index / 4) * 2
      const x = 50 + Math.cos(angle) * ringOffset
      const y = 50 + Math.sin(angle) * ringOffset
      positioned.push({ metric, x, y })
    }
  }
  return positioned
}

function shortLabel(label: string): string {
  return label
    .replace('Position', 'Pos')
    .replace('Spread', 'Spr')
    .replace('Change', 'Chg')
    .replace('Deviation', 'Dev')
}

function nodeTone(state: IndicatorMetric['currentState']): string {
  if (state === 'high') return '#e5443d'
  if (state === 'low') return '#d4a853'
  return '#e5a825'
}

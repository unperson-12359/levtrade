import { useMemo } from 'react'
import { formatCorrelation } from '../../observatory/format'
import type { CorrelationEdge, IndicatorMetric, CandleHitCluster, IndicatorCategory } from '../../observatory/types'

const CATEGORY_ORDER: IndicatorCategory[] = ['Trend', 'Momentum', 'Volatility', 'Volume', 'Structure']

interface CorrelationInsightsProps {
  indicators: IndicatorMetric[]
  edges: CorrelationEdge[]
  timeline: CandleHitCluster[]
}

interface LeadingPair {
  leaderId: string
  leaderLabel: string
  leaderCategory: IndicatorCategory
  followerId: string
  followerLabel: string
  followerCategory: IndicatorCategory
  lagBars: number
  lagCorrelation: number
  strength: number
}

interface ActiveCluster {
  categories: IndicatorCategory[]
  indicators: { id: string; label: string; category: IndicatorCategory }[]
  significance: string
}

interface DivergencePair {
  aLabel: string
  aCategory: IndicatorCategory
  aState: string
  bLabel: string
  bCategory: IndicatorCategory
  bState: string
  correlation: number
}

export function CorrelationInsights({ indicators, edges, timeline }: CorrelationInsightsProps) {
  const indicatorMap = useMemo(
    () => new Map(indicators.map((ind) => [ind.id, ind])),
    [indicators],
  )

  // Panel 1: Leading indicators — edges with significant lag correlation
  const leadingPairs = useMemo(() => {
    const pairs: LeadingPair[] = []
    for (const edge of edges) {
      if (Math.abs(edge.lagBars) < 1 || Math.abs(edge.lagCorrelation) < 0.4) continue
      const a = indicatorMap.get(edge.a)
      const b = indicatorMap.get(edge.b)
      if (!a || !b) continue

      const isALeader = edge.lagBars > 0
      const leader = isALeader ? a : b
      const follower = isALeader ? b : a

      pairs.push({
        leaderId: leader.id,
        leaderLabel: leader.label,
        leaderCategory: leader.category,
        followerId: follower.id,
        followerLabel: follower.label,
        followerCategory: follower.category,
        lagBars: Math.abs(edge.lagBars),
        lagCorrelation: edge.lagCorrelation,
        strength: edge.strength,
      })
    }
    return pairs
      .sort((a, b) => Math.abs(b.lagCorrelation) - Math.abs(a.lagCorrelation))
      .slice(0, 8)
  }, [edges, indicatorMap])

  // Panel 2: Active clusters — indicators firing together on the latest candle
  const activeClusters = useMemo(() => {
    const latest = timeline[timeline.length - 1]
    if (!latest) return []

    const activeIds = new Set(latest.events.map((e) => e.indicatorId))
    const activeIndicators = indicators
      .filter((ind) => activeIds.has(ind.id))
      .map((ind) => ({ id: ind.id, label: ind.label, category: ind.category }))

    if (activeIndicators.length === 0) return []

    // Group by category
    const byCategory = new Map<IndicatorCategory, typeof activeIndicators>()
    for (const ind of activeIndicators) {
      const group = byCategory.get(ind.category) ?? []
      group.push(ind)
      byCategory.set(ind.category, group)
    }

    // Build cross-category cluster
    const activeCategories = CATEGORY_ORDER.filter((cat) => byCategory.has(cat))
    const clusters: ActiveCluster[] = []

    if (activeCategories.length >= 2) {
      const significance =
        activeCategories.length >= 4
          ? 'Strong multi-category alignment — high conviction environment'
          : activeCategories.length >= 3
            ? 'Cross-category pressure building — watch for directional follow-through'
            : 'Two categories aligned — partial convergence'

      clusters.push({
        categories: activeCategories,
        indicators: activeIndicators,
        significance,
      })
    }

    return clusters
  }, [indicators, timeline])

  // Panel 3: Divergences — normally correlated indicators that currently disagree
  const divergences = useMemo(() => {
    const results: DivergencePair[] = []
    for (const edge of edges) {
      if (edge.strength < 0.5 || edge.pearson < 0.4) continue
      const a = indicatorMap.get(edge.a)
      const b = indicatorMap.get(edge.b)
      if (!a || !b) continue

      const statesDisagree =
        (a.currentState === 'high' && b.currentState === 'low') ||
        (a.currentState === 'low' && b.currentState === 'high')

      if (!statesDisagree) continue

      results.push({
        aLabel: a.label,
        aCategory: a.category,
        aState: a.currentState,
        bLabel: b.label,
        bCategory: b.category,
        bState: b.currentState,
        correlation: edge.pearson,
      })
    }
    return results
      .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
      .slice(0, 6)
  }, [edges, indicatorMap])

  return (
    <div className="obs-insights" data-testid="obs-correlation-insights">
      <section className="obs-insights__panel">
        <div className="obs-insights__head">
          <div className="obs-panel__eyebrow">Predictive relationships</div>
          <h3 className="obs-insights__title">Leading indicators</h3>
        </div>
        <p className="obs-panel__copy">
          Indicators whose state changes predict future changes in other indicators. A 2-bar lead means this indicator
          moved first and the follower responded ~2 days later.
        </p>
        {leadingPairs.length > 0 ? (
          <div className="obs-insights__rows">
            {leadingPairs.map((pair) => (
              <div key={`${pair.leaderId}-${pair.followerId}`} className="obs-insights__row">
                <div className="obs-insights__row-main">
                  <strong>{pair.leaderLabel}</strong>
                  <span className="obs-insights__arrow">→</span>
                  <span>{pair.followerLabel}</span>
                </div>
                <div className="obs-insights__row-meta">
                  <span className="obs-insights__badge">{pair.lagBars}d lead</span>
                  <span className="obs-insights__badge obs-insights__badge--correlation">
                    r = {formatCorrelation(pair.lagCorrelation)}
                  </span>
                  <span className="obs-insights__category">{pair.leaderCategory} → {pair.followerCategory}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="obs-empty">No significant leading relationships detected in the current window.</div>
        )}
      </section>

      <section className="obs-insights__panel">
        <div className="obs-insights__head">
          <div className="obs-panel__eyebrow">Current state</div>
          <h3 className="obs-insights__title">Active clusters</h3>
        </div>
        <p className="obs-panel__copy">
          Indicators firing together across multiple categories. Cross-category alignment is a stronger signal than
          single-category clustering.
        </p>
        {activeClusters.length > 0 ? (
          activeClusters.map((cluster, i) => (
            <div key={i} className="obs-insights__cluster">
              <div className="obs-insights__cluster-cats">
                {cluster.categories.map((cat) => (
                  <span key={cat} className="obs-insights__badge obs-insights__badge--category">{cat}</span>
                ))}
              </div>
              <div className="obs-insights__cluster-sig">{cluster.significance}</div>
              <div className="obs-insights__cluster-list">
                {cluster.indicators.map((ind) => (
                  <span key={ind.id} className="obs-insights__cluster-ind">{ind.label}</span>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="obs-empty">No cross-category clusters active on the latest candle.</div>
        )}
      </section>

      <section className="obs-insights__panel">
        <div className="obs-insights__head">
          <div className="obs-panel__eyebrow">Anomaly detection</div>
          <h3 className="obs-insights__title">Correlation breaks</h3>
        </div>
        <p className="obs-panel__copy">
          Indicator pairs that normally move together but are currently in opposing states. Divergences often precede
          trend reversals or regime shifts.
        </p>
        {divergences.length > 0 ? (
          <div className="obs-insights__rows">
            {divergences.map((pair) => (
              <div key={`${pair.aLabel}-${pair.bLabel}`} className="obs-insights__row obs-insights__row--divergence">
                <div className="obs-insights__row-main">
                  <span>
                    <strong>{pair.aLabel}</strong>
                    <span className={`obs-insights__state obs-insights__state--${pair.aState}`}>{pair.aState}</span>
                  </span>
                  <span className="obs-insights__vs">≠</span>
                  <span>
                    <strong>{pair.bLabel}</strong>
                    <span className={`obs-insights__state obs-insights__state--${pair.bState}`}>{pair.bState}</span>
                  </span>
                </div>
                <div className="obs-insights__row-meta">
                  <span className="obs-insights__badge">Usually r = {formatCorrelation(pair.correlation)}</span>
                  <span className="obs-insights__category">{pair.aCategory} vs {pair.bCategory}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="obs-empty">No correlation breaks detected — correlated indicators agree.</div>
        )}
      </section>
    </div>
  )
}

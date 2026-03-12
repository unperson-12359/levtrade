import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CandlestickSeries,
  ColorType,
  createSeriesMarkers,
  createChart,
  CrosshairMode,
  type IRange,
  LineSeries,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import { useChartModel } from '../../hooks/useChartModel'
import { formatUtcDateTime } from '../../observatory/timeFormat'
import type { CandleHitCluster } from '../../observatory/types'
import { ChartLegend } from './ChartLegend'
import type { Candle, TrackedCoin } from '../../types/market'

interface PriceChartProps {
  coin: TrackedCoin
  embedded?: boolean
  showHeader?: boolean
  chartCandles?: Candle[] | null
  timeline?: CandleHitCluster[]
  selectedTime?: number | null
  clusterMode?: 'simple' | 'pro'
  onSelectClusterTime?: (time: number) => void
  onOpenClusterReport?: (time: number) => void
}

export function PriceChart({
  coin,
  embedded = false,
  showHeader = true,
  chartCandles = null,
  timeline = [],
  selectedTime = null,
  clusterMode = 'simple',
  onSelectClusterTime,
  onOpenClusterReport,
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const markerPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const meanSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const upperSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const lowerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const priceLinesRef = useRef<IPriceLine[] | null>(null)
  const focusRangeRef = useRef<IRange<Time> | null>(null)
  const lastPriceLinesSignatureRef = useRef<string | null>(null)
  const hasInitializedViewportRef = useRef(false)
  const userInteractedRef = useRef(false)
  const viewportKeyRef = useRef<string | null>(null)
  const syncClusterBubblesRef = useRef<(() => void) | null>(null)
  const [chartEpoch, setChartEpoch] = useState(0)
  const [clusterBubbleLayouts, setClusterBubbleLayouts] = useState<ChartClusterBubbleLayout[]>([])
  const model = useChartModel(coin, { candlesOverride: chartCandles })
  const showLiveOverlays = !chartCandles
  const viewportKey = getViewportKey(coin, chartCandles)
  const showClusterOverlay = timeline.length > 0 && !chartCandles

  const resetView = useCallback(() => {
    const chart = chartRef.current
    if (!chart) return

    if (focusRangeRef.current) {
      chart.timeScale().setVisibleRange(focusRangeRef.current)
    } else {
      chart.timeScale().fitContent()
    }

    userInteractedRef.current = false
    syncClusterBubblesRef.current?.()
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const styles = getComputedStyle(document.documentElement)
    const container = containerRef.current
    const chart = createChart(containerRef.current, {
      width: container.clientWidth,
      height: container.clientHeight || 380,
      layout: {
        background: { type: ColorType.Solid, color: styles.getPropertyValue('--color-bg-card').trim() },
        textColor: styles.getPropertyValue('--color-text-secondary').trim(),
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: {
        mode: CrosshairMode.MagnetOHLC,
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.08)',
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: true,
      },
      handleScroll: true,
      handleScale: true,
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#3dd68c',
      downColor: '#e5443d',
      wickUpColor: '#3dd68c',
      wickDownColor: '#e5443d',
      borderVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    const meanSeries = chart.addSeries(LineSeries, {
      color: '#d4a853',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    const upperSeries = chart.addSeries(LineSeries, {
      color: 'rgba(200, 149, 110, 0.7)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    const lowerSeries = chart.addSeries(LineSeries, {
      color: 'rgba(200, 149, 110, 0.7)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    markerPluginRef.current = createSeriesMarkers(candleSeries, [])
    meanSeriesRef.current = meanSeries
    upperSeriesRef.current = upperSeries
    lowerSeriesRef.current = lowerSeries
    hasInitializedViewportRef.current = false
    userInteractedRef.current = false
    viewportKeyRef.current = null
    setChartEpoch((value) => value + 1)

    const markUserInteraction = () => {
      userInteractedRef.current = true
    }

    container.addEventListener('mousedown', markUserInteraction)
    container.addEventListener('wheel', markUserInteraction, { passive: true })
    container.addEventListener('touchstart', markUserInteraction, { passive: true })

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      chart.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height })
      if (hasInitializedViewportRef.current && !userInteractedRef.current && focusRangeRef.current) {
        chart.timeScale().setVisibleRange(focusRangeRef.current)
      }
      syncClusterBubblesRef.current?.()
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      container.removeEventListener('mousedown', markUserInteraction)
      container.removeEventListener('wheel', markUserInteraction)
      container.removeEventListener('touchstart', markUserInteraction)
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      markerPluginRef.current = null
      meanSeriesRef.current = null
      upperSeriesRef.current = null
      lowerSeriesRef.current = null
      priceLinesRef.current = null
      lastPriceLinesSignatureRef.current = null
      syncClusterBubblesRef.current = null
      setClusterBubbleLayouts([])
    }
  }, [coin])

  useEffect(() => {
    if (!candleSeriesRef.current || !meanSeriesRef.current || !upperSeriesRef.current || !lowerSeriesRef.current) {
      return
    }

    candleSeriesRef.current.setData(model.candles)
    markerPluginRef.current?.setMarkers(model.markers)
    meanSeriesRef.current.setData(model.meanLine)
    upperSeriesRef.current.setData(model.upperBandLine)
    lowerSeriesRef.current.setData(model.lowerBandLine)

    const nextPriceLinesSignature = getPriceLinesSignature(model.priceLines)
    if (lastPriceLinesSignatureRef.current !== nextPriceLinesSignature) {
      const existingPriceLines = priceLinesRef.current ?? []

      for (const line of existingPriceLines) {
        candleSeriesRef.current.removePriceLine(line)
      }

      priceLinesRef.current = model.priceLines.map((line) =>
        candleSeriesRef.current!.createPriceLine({
          price: line.price,
          color: line.color,
          lineWidth: 1,
          lineStyle: line.lineStyle ?? LineStyle.Solid,
          axisLabelVisible: true,
          title: line.title,
        }),
      )
      lastPriceLinesSignatureRef.current = nextPriceLinesSignature
    }

    focusRangeRef.current = model.focusRange
    if (!hasInitializedViewportRef.current || viewportKeyRef.current !== viewportKey) {
      resetView()
      hasInitializedViewportRef.current = true
      viewportKeyRef.current = viewportKey
    }
  }, [model, resetView, viewportKey])

  useEffect(() => {
    if (!showClusterOverlay || !chartRef.current || !containerRef.current || !candleSeriesRef.current) {
      setClusterBubbleLayouts([])
      syncClusterBubblesRef.current = null
      return
    }

    const chart = chartRef.current
    const candleSeries = candleSeriesRef.current
    const container = containerRef.current
    const syncBubbleLayout = () => {
      setClusterBubbleLayouts(
        buildChartClusterBubbleLayouts({
          chart,
          candleSeries,
          clusterMode,
          containerHeight: container.clientHeight,
          containerWidth: container.clientWidth,
          selectedTime,
          timeline,
        }),
      )
    }

    syncClusterBubblesRef.current = syncBubbleLayout
    syncBubbleLayout()
    chart.timeScale().subscribeVisibleTimeRangeChange(syncBubbleLayout)

    return () => {
      if (syncClusterBubblesRef.current === syncBubbleLayout) {
        syncClusterBubblesRef.current = null
      }
      chart.timeScale().unsubscribeVisibleTimeRangeChange(syncBubbleLayout)
    }
  }, [chartEpoch, clusterMode, model.candles.length, selectedTime, showClusterOverlay, timeline])

  const handleClusterBubbleClick = useCallback((time: number) => {
    onSelectClusterTime?.(time)
    onOpenClusterReport?.(time)
  }, [onOpenClusterReport, onSelectClusterTime])

  return (
    <section className={embedded ? 'chart-shell' : 'panel-shell panel-shell--chart'}>
      {showHeader && (
        <div className="panel-header">
          <div>
            <div className="panel-kicker">Price Context</div>
            <h2 className="panel-title">{coin} Market Structure</h2>
          </div>
          <button type="button" className="chart-reset-button" onClick={resetView}>
            Reset view
          </button>
        </div>
      )}

      {!showHeader && (
        <div className="price-chart__toolbar">
          <button type="button" className="chart-reset-button" onClick={resetView}>
            Reset view
          </button>
        </div>
      )}

      <ChartLegend items={model.legend} />

      <div className="price-chart-wrap">
        <div ref={containerRef} className="price-chart" />
        {showClusterOverlay && clusterBubbleLayouts.length > 0 && (
          <div className="chart-cluster-overlay" data-testid="obs-chart-cluster-overlay">
            {clusterBubbleLayouts.map((bubble) => (
              <button
                key={bubble.time}
                type="button"
                className={`chart-cluster-bubble chart-cluster-bubble--${bubble.level} ${bubble.selected ? 'chart-cluster-bubble--selected' : ''}`}
                style={{
                  left: `${bubble.left}px`,
                  top: `${bubble.top}px`,
                  width: `${bubble.diameter}px`,
                  height: `${bubble.diameter}px`,
                  zIndex: bubble.zIndex,
                }}
                onClick={() => handleClusterBubbleClick(bubble.time)}
                title={bubble.title}
                aria-label={bubble.ariaLabel}
                data-testid="obs-chart-cluster-bubble"
              >
                <span className="chart-cluster-bubble__count">{bubble.displayCount}</span>
              </button>
            ))}
          </div>
        )}
        {showLiveOverlays && model.isWarmingUp && (
          <div className="chart-overlay">
            <span>Building the initial band context from recent candles.</span>
          </div>
        )}
        {showLiveOverlays && model.isStale && (
          <div className="chart-overlay chart-overlay--danger">
            <span>Live chart context is delayed. Wait for the feed to recover before trusting the read.</span>
          </div>
        )}
      </div>
    </section>
  )
}

function getViewportKey(
  coin: TrackedCoin,
  chartCandles?: Candle[] | null,
): string {
  return `${coin}:${chartCandles ? `override:${chartCandles.length}` : 'live'}`
}

function getPriceLinesSignature(
  priceLines: Array<{
    title: string
    price: number
    color: string
    lineStyle?: LineStyle
  }>,
): string {
  return priceLines
    .map((line) => `${line.title}:${line.price.toFixed(6)}:${line.color}:${line.lineStyle ?? LineStyle.Solid}`)
    .join('|')
}

interface ChartClusterBubbleLayout {
  time: number
  left: number
  top: number
  diameter: number
  displayCount: string
  level: 'l1' | 'l2' | 'l3' | 'l4'
  selected: boolean
  title: string
  ariaLabel: string
  zIndex: number
}

function buildChartClusterBubbleLayouts({
  chart,
  candleSeries,
  clusterMode,
  containerHeight,
  containerWidth,
  selectedTime,
  timeline,
}: {
  chart: IChartApi
  candleSeries: ISeriesApi<'Candlestick'>
  clusterMode: 'simple' | 'pro'
  containerHeight: number
  containerWidth: number
  selectedTime: number | null
  timeline: CandleHitCluster[]
}): ChartClusterBubbleLayout[] {
  if (containerWidth <= 0 || containerHeight <= 0 || timeline.length === 0) return []

  const visibleRange = chart.timeScale().getVisibleRange()
  if (!visibleRange) return []

  const visibleFrom = normalizeChartTime(visibleRange.from)
  const visibleTo = normalizeChartTime(visibleRange.to)
  if (visibleFrom === null || visibleTo === null) return []

  const visibleClusters = timeline.filter((cluster) => {
    if (cluster.totalHits <= 0) return false
    const seconds = Math.floor(cluster.time / 1000)
    return seconds >= visibleFrom && seconds <= visibleTo
  })
  if (visibleClusters.length === 0) return []

  const narrow = containerWidth <= 760
  const maxVisibleHits = visibleClusters.reduce((maxHits, cluster) => Math.max(maxHits, cluster.totalHits), 0)
  const edgePadding = narrow ? 10 : 14
  const positionedVisibleClusters: PositionedVisibleCluster[] = []

  for (const cluster of visibleClusters) {
    const x = chart.timeScale().timeToCoordinate(Math.floor(cluster.time / 1000) as UTCTimestamp)
    const highY = candleSeries.priceToCoordinate(cluster.price.high)
    const lowY = candleSeries.priceToCoordinate(cluster.price.low)
    if (x === null || highY === null || lowY === null || !Number.isFinite(x) || !Number.isFinite(highY) || !Number.isFinite(lowY)) continue

    positionedVisibleClusters.push({
      cluster,
      x,
      highY,
      lowY,
      diameter: resolveClusterCircleDiameter(cluster.totalHits, maxVisibleHits, narrow),
      level: intensityLevel(cluster.totalHits, maxVisibleHits),
    })
  }
  if (positionedVisibleClusters.length === 0) return []

  const maxBubbles = resolveClusterBubbleLimit(containerWidth, clusterMode)
  const shortlisted = selectStrongestVisibleClusters(positionedVisibleClusters, maxBubbles, selectedTime)
  if (shortlisted.length === 0) return []

  const layouts = placeClusterCircles({
    candidates: shortlisted,
    containerHeight,
    containerWidth,
    edgePadding,
    selectedTime,
  })

  return layouts.sort((a, b) => a.time - b.time)
}

function selectStrongestVisibleClusters(
  visibleClusters: PositionedVisibleCluster[],
  maxBubbles: number,
  selectedTime: number | null,
): PositionedVisibleCluster[] {
  const latestTime = visibleClusters[visibleClusters.length - 1]?.cluster.time ?? null
  const ranked = [...visibleClusters].sort((a, b) => {
    const aPriority = resolveClusterPriority(a, selectedTime, latestTime)
    const bPriority = resolveClusterPriority(b, selectedTime, latestTime)
    return bPriority - aPriority || b.cluster.time - a.cluster.time
  })

  const kept: PositionedVisibleCluster[] = []
  for (const cluster of ranked) {
    if (!canKeepCluster(cluster, kept)) continue
    kept.push(cluster)
    if (kept.length >= maxBubbles) break
  }

  return kept
}

function resolveClusterBubbleLimit(containerWidth: number, clusterMode: 'simple' | 'pro'): number {
  if (containerWidth <= 760) return clusterMode === 'pro' ? 8 : 6
  return clusterMode === 'pro' ? 14 : 10
}

function placeClusterCircles({
  candidates,
  containerHeight,
  containerWidth,
  edgePadding,
  selectedTime,
}: {
  candidates: PositionedVisibleCluster[]
  containerHeight: number
  containerWidth: number
  edgePadding: number
  selectedTime: number | null
}): ChartClusterBubbleLayout[] {
  const placed: ChartClusterBubbleLayout[] = []

  for (const candidate of candidates) {
    const left = clamp(candidate.x, candidate.diameter / 2 + edgePadding, containerWidth - candidate.diameter / 2 - edgePadding)
    const centers = buildCandidateCenters(candidate, containerHeight)
    let chosenTop = centers.find((centerY) => !hasCircleCollision(left, centerY, candidate.diameter, placed)) ?? null

    if (chosenTop === null && candidate.cluster.time === selectedTime) {
      chosenTop = centers[0] ?? null
    }
    if (chosenTop === null) continue

    const labels = candidate.cluster.topHits.slice(0, 3).map((hit) => hit.indicatorLabel)
    placed.push({
      time: candidate.cluster.time,
      left,
      top: chosenTop,
      diameter: candidate.diameter,
      displayCount: formatClusterDisplayCount(candidate.cluster.totalHits),
      level: candidate.level,
      selected: candidate.cluster.time === selectedTime,
      title: `${formatUtcDateTime(candidate.cluster.time)} | ${candidate.cluster.topHits.slice(0, 3).map((hit) => hit.message).join(' | ')}`,
      ariaLabel: `${candidate.cluster.totalHits} active states at ${formatUtcDateTime(candidate.cluster.time)}. ${labels.join(', ')}`,
      zIndex: candidate.cluster.time === selectedTime ? 4 : candidate.cluster.totalHits >= 20 ? 3 : 2,
    })
  }

  return placed
}

function canKeepCluster(
  candidate: PositionedVisibleCluster,
  kept: PositionedVisibleCluster[],
): boolean {
  if (kept.some((entry) => entry.cluster.time === candidate.cluster.time)) return true
  for (const existing of kept) {
    const minDistance = (candidate.diameter + existing.diameter) * 0.46
    if (Math.abs(existing.x - candidate.x) < minDistance) {
      return false
    }
  }
  return true
}

function buildCandidateCenters(candidate: PositionedVisibleCluster, containerHeight: number): number[] {
  const radius = candidate.diameter / 2
  const preferredAbove = candidate.highY - radius - 12
  const preferredBelow = candidate.lowY + radius + 12
  const minCenter = radius + 8
  const maxCenter = containerHeight - radius - 8
  const preferAbove = preferredAbove >= minCenter

  const primaryBase = clamp(preferAbove ? preferredAbove : preferredBelow, minCenter, maxCenter)
  const secondaryBase = clamp(preferAbove ? preferredBelow : preferredAbove, minCenter, maxCenter)
  const offsets = [0, -16, 16, -30, 30]
  const centers: number[] = []

  for (const offset of offsets) {
    centers.push(clamp(primaryBase + offset, minCenter, maxCenter))
  }
  for (const offset of offsets) {
    centers.push(clamp(secondaryBase + offset, minCenter, maxCenter))
  }

  return [...new Set(centers)]
}

function hasCircleCollision(left: number, top: number, diameter: number, placed: ChartClusterBubbleLayout[]): boolean {
  for (const existing of placed) {
    const minDistance = (diameter + existing.diameter) / 2 + 4
    if (Math.hypot(left - existing.left, top - existing.top) < minDistance) {
      return true
    }
  }
  return false
}

function resolveClusterPriority(
  cluster: PositionedVisibleCluster,
  selectedTime: number | null,
  latestTime: number | null,
): number {
  if (cluster.cluster.time === selectedTime) return 10_000 + cluster.cluster.totalHits
  if (cluster.cluster.time === latestTime) return 5_000 + cluster.cluster.totalHits
  return cluster.cluster.totalHits * 100 + cluster.cluster.topHits.length
}

function resolveClusterCircleDiameter(totalHits: number, maxVisibleHits: number, narrow: boolean): number {
  const minDiameter = narrow ? 16 : 18
  const maxDiameter = narrow ? 26 : 30
  if (maxVisibleHits <= 0) return minDiameter
  const ratio = totalHits / maxVisibleHits
  return Math.round(minDiameter + (maxDiameter - minDiameter) * ratio)
}

function formatClusterDisplayCount(totalHits: number): string {
  if (totalHits > 99) return '99+'
  return String(totalHits)
}

function intensityLevel(count: number, maxCount: number): 'l1' | 'l2' | 'l3' | 'l4' {
  if (maxCount <= 0) return 'l1'
  const ratio = count / maxCount
  if (ratio < 0.25) return 'l1'
  if (ratio < 0.5) return 'l2'
  if (ratio < 0.75) return 'l3'
  return 'l4'
}

interface PositionedVisibleCluster {
  cluster: CandleHitCluster
  x: number
  highY: number
  lowY: number
  diameter: number
  level: 'l1' | 'l2' | 'l3' | 'l4'
}

function normalizeChartTime(time: Time | null): number | null {
  if (typeof time === 'number') return time
  if (typeof time === 'string') {
    const parsed = Number.parseInt(time, 10)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (!time) return null
  return Math.floor(Date.UTC(time.year, time.month - 1, time.day) / 1000)
}

function clamp(value: number, min: number, max: number): number {
  if (min > max) return value
  return Math.min(Math.max(value, min), max)
}

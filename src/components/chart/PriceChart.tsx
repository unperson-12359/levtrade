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
    if (!showClusterOverlay || !chartRef.current || !containerRef.current) {
      setClusterBubbleLayouts([])
      syncClusterBubblesRef.current = null
      return
    }

    const chart = chartRef.current
    const container = containerRef.current
    const syncBubbleLayout = () => {
      setClusterBubbleLayouts(
        buildChartClusterBubbleLayouts({
          chart,
          clusterMode,
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
                className={`chart-cluster-bubble ${bubble.selected ? 'chart-cluster-bubble--selected' : ''}`}
                style={{ left: `${bubble.left}px`, top: `${bubble.top}px` }}
                onClick={() => handleClusterBubbleClick(bubble.time)}
                title={bubble.title}
                aria-label={bubble.ariaLabel}
                data-testid="obs-chart-cluster-bubble"
              >
                <span className="chart-cluster-bubble__count">{bubble.totalHits} active</span>
                <span className="chart-cluster-bubble__hits">
                  {bubble.labels.map((label) => (
                    <span key={`${bubble.time}:${label}`} className="chart-cluster-bubble__hit">{label}</span>
                  ))}
                </span>
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
  selected: boolean
  totalHits: number
  labels: string[]
  title: string
  ariaLabel: string
}

function buildChartClusterBubbleLayouts({
  chart,
  clusterMode,
  containerWidth,
  selectedTime,
  timeline,
}: {
  chart: IChartApi
  clusterMode: 'simple' | 'pro'
  containerWidth: number
  selectedTime: number | null
  timeline: CandleHitCluster[]
}): ChartClusterBubbleLayout[] {
  if (containerWidth <= 0 || timeline.length === 0) return []

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
  const bubbleWidth = narrow ? 124 : clusterMode === 'pro' ? 156 : 144
  const rowCount = narrow ? 2 : 3
  const rowGap = narrow ? 10 : 12
  const rowHeight = narrow ? 56 : 64
  const edgePadding = narrow ? 12 : 18
  const positionedVisibleClusters: Array<{ cluster: CandleHitCluster; x: number }> = []

  for (const cluster of visibleClusters) {
    const x = chart.timeScale().timeToCoordinate(Math.floor(cluster.time / 1000) as UTCTimestamp)
    if (x === null || !Number.isFinite(x)) continue
    positionedVisibleClusters.push({ cluster, x })
  }
  if (positionedVisibleClusters.length === 0) return []

  const maxBubbles = resolveClusterBubbleLimit(containerWidth, clusterMode)
  const shortlisted = selectStrongestVisibleClusters(positionedVisibleClusters, maxBubbles, selectedTime, bubbleWidth * 0.74)
  if (shortlisted.length === 0) return []

  const rowRightEdges = new Array(rowCount).fill(Number.NEGATIVE_INFINITY)
  return shortlisted
    .sort((a, b) => a.cluster.time - b.cluster.time)
    .map(({ cluster, x }) => {
      const clampedLeft = clamp(x, bubbleWidth / 2 + edgePadding, containerWidth - bubbleWidth / 2 - edgePadding)
      const row = pickBubbleRow(rowRightEdges, clampedLeft, bubbleWidth, narrow ? 8 : 12)
      rowRightEdges[row] = clampedLeft + bubbleWidth / 2
      const labels = cluster.topHits.slice(0, 3).map((hit) => hit.indicatorLabel)

      return {
        time: cluster.time,
        left: clampedLeft,
        top: 12 + row * (rowHeight + rowGap),
        selected: cluster.time === selectedTime,
        totalHits: cluster.totalHits,
        labels,
        title: `${formatUtcDateTime(cluster.time)} | ${cluster.topHits.slice(0, 3).map((hit) => hit.message).join(' | ')}`,
        ariaLabel: `${cluster.totalHits} active states at ${formatUtcDateTime(cluster.time)}. ${labels.join(', ')}`,
      }
    })
}

function selectStrongestVisibleClusters(
  visibleClusters: Array<{ cluster: CandleHitCluster; x: number }>,
  maxBubbles: number,
  selectedTime: number | null,
  minDistance: number,
): Array<{ cluster: CandleHitCluster; x: number }> {
  const selectedCluster = selectedTime === null ? null : visibleClusters.find((entry) => entry.cluster.time === selectedTime) ?? null
  const latestCluster = visibleClusters[visibleClusters.length - 1] ?? null
  const kept = new Map<number, { cluster: CandleHitCluster; x: number }>()

  if (selectedCluster) kept.set(selectedCluster.cluster.time, selectedCluster)
  if (latestCluster && canKeepCluster(latestCluster, kept, minDistance * 0.5)) {
    kept.set(latestCluster.cluster.time, latestCluster)
  }

  const ranked = [...visibleClusters].sort(
    (a, b) =>
      b.cluster.totalHits - a.cluster.totalHits ||
      b.cluster.topHits.length - a.cluster.topHits.length ||
      b.cluster.time - a.cluster.time,
  )
  for (const cluster of ranked) {
    if (!canKeepCluster(cluster, kept, minDistance)) continue
    kept.set(cluster.cluster.time, cluster)
    if (kept.size >= maxBubbles) break
  }

  return [...kept.values()].sort((a, b) => a.cluster.time - b.cluster.time)
}

function resolveClusterBubbleLimit(containerWidth: number, clusterMode: 'simple' | 'pro'): number {
  if (containerWidth <= 760) return clusterMode === 'pro' ? 8 : 6
  return clusterMode === 'pro' ? 14 : 10
}

function pickBubbleRow(rowRightEdges: number[], centerX: number, bubbleWidth: number, minGap: number): number {
  const leftEdge = centerX - bubbleWidth / 2

  for (let index = 0; index < rowRightEdges.length; index += 1) {
    const rowRightEdge = rowRightEdges[index] ?? Number.NEGATIVE_INFINITY
    if (leftEdge - rowRightEdge >= minGap) {
      return index
    }
  }

  let bestRow = 0
  let smallestRightEdge = rowRightEdges[0] ?? Number.POSITIVE_INFINITY
  for (let index = 1; index < rowRightEdges.length; index += 1) {
    const rowRightEdge = rowRightEdges[index] ?? Number.POSITIVE_INFINITY
    if (rowRightEdge < smallestRightEdge) {
      smallestRightEdge = rowRightEdge
      bestRow = index
    }
  }
  return bestRow
}

function canKeepCluster(
  candidate: { cluster: CandleHitCluster; x: number },
  kept: Map<number, { cluster: CandleHitCluster; x: number }>,
  minDistance: number,
): boolean {
  if (kept.has(candidate.cluster.time)) return true
  for (const existing of kept.values()) {
    if (Math.abs(existing.x - candidate.x) < minDistance) {
      return false
    }
  }
  return true
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

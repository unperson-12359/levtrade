import { useCallback, useEffect, useRef } from 'react'
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
} from 'lightweight-charts'
import { useChartModel } from '../../hooks/useChartModel'
import { useSignals } from '../../hooks/useSignals'
import { ChartLegend } from './ChartLegend'
import type { Candle, TrackedCoin } from '../../types/market'
import type { SuggestedSetup } from '../../types/setup'

interface PriceChartProps {
  coin: TrackedCoin
  embedded?: boolean
  showHeader?: boolean
  verificationSetup?: SuggestedSetup | null
  chartCandles?: Candle[] | null
  reviewMode?: 'live' | 'historical'
}

export function PriceChart({
  coin,
  embedded = false,
  showHeader = true,
  verificationSetup = null,
  chartCandles = null,
  reviewMode = 'live',
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
  const model = useChartModel(coin, verificationSetup, { candlesOverride: chartCandles, reviewMode })
  const { signals } = useSignals(coin)
  const showLiveOverlays = reviewMode === 'live' && !chartCandles
  const viewportKey = getViewportKey(coin, reviewMode, verificationSetup)

  const resetView = useCallback(() => {
    const chart = chartRef.current
    if (!chart) return

    if (focusRangeRef.current) {
      chart.timeScale().setVisibleRange(focusRangeRef.current)
    } else {
      chart.timeScale().fitContent()
    }

    userInteractedRef.current = false
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

  return (
    <section className={embedded ? 'chart-shell' : 'panel-shell panel-shell--chart'}>
      {showHeader && (
        <div className="panel-header">
          <div>
            <div className="panel-kicker">Price Geometry</div>
            <h2 className="panel-title">{coin} Entry Map</h2>
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
        {showLiveOverlays && signals?.isWarmingUp && (
          <div className="chart-overlay">
            <span>Warming up geometry with more candles.</span>
          </div>
        )}
        {showLiveOverlays && signals?.isStale && (
          <div className="chart-overlay chart-overlay--danger">
            <span>Live feed is stale. Re-check before entering.</span>
          </div>
        )}
      </div>
    </section>
  )
}

function getViewportKey(
  coin: TrackedCoin,
  reviewMode: 'live' | 'historical',
  verificationSetup?: SuggestedSetup | null,
): string {
  if (reviewMode === 'historical') {
    return `${coin}:historical:${verificationSetup?.generatedAt ?? 'none'}`
  }

  return `${coin}:live:${verificationSetup?.generatedAt ?? 'none'}`
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

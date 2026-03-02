import { useEffect, useRef } from 'react'
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  LineSeries,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
} from 'lightweight-charts'
import { useChartModel } from '../../hooks/useChartModel'
import { useSignals } from '../../hooks/useSignals'
import { ChartLegend } from './ChartLegend'
import type { TrackedCoin } from '../../types/market'
import type { SuggestedSetup } from '../../types/setup'

interface PriceChartProps {
  coin: TrackedCoin
  embedded?: boolean
  showHeader?: boolean
  verificationSetup?: SuggestedSetup | null
}

export function PriceChart({
  coin,
  embedded = false,
  showHeader = true,
  verificationSetup = null,
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const meanSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const upperSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const lowerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const priceLinesRef = useRef<IPriceLine[] | null>(null)
  const model = useChartModel(coin, verificationSetup)
  const { signals } = useSignals(coin)

  useEffect(() => {
    if (!containerRef.current) return

    const styles = getComputedStyle(document.documentElement)
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 460,
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
      upColor: '#22c55e',
      downColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      borderVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    const meanSeries = chart.addSeries(LineSeries, {
      color: '#60a5fa',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    const upperSeries = chart.addSeries(LineSeries, {
      color: 'rgba(234, 179, 8, 0.9)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    const lowerSeries = chart.addSeries(LineSeries, {
      color: 'rgba(234, 179, 8, 0.9)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    meanSeriesRef.current = meanSeries
    upperSeriesRef.current = upperSeries
    lowerSeriesRef.current = lowerSeries

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      chart.applyOptions({ width: entry.contentRect.width })
      chart.timeScale().fitContent()
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      meanSeriesRef.current = null
      upperSeriesRef.current = null
      lowerSeriesRef.current = null
      priceLinesRef.current = null
    }
  }, [coin])

  useEffect(() => {
    if (!candleSeriesRef.current || !meanSeriesRef.current || !upperSeriesRef.current || !lowerSeriesRef.current) {
      return
    }

    candleSeriesRef.current.setData(model.candles)
    meanSeriesRef.current.setData(model.meanLine)
    upperSeriesRef.current.setData(model.upperBandLine)
    lowerSeriesRef.current.setData(model.lowerBandLine)

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

    chartRef.current?.timeScale().fitContent()
  }, [model])

  return (
    <section className={embedded ? 'chart-shell' : 'panel-shell panel-shell--chart'}>
      {showHeader && (
        <div className="panel-header">
          <div>
            <div className="panel-kicker">Price Geometry</div>
            <h2 className="panel-title">{coin} Entry Map</h2>
          </div>
          {signals && (
            <div className="panel-status">
              <span className={`status-pill status-pill--${signals.entryGeometry.color}`}>
                {signals.entryGeometry.entryQuality.replace('-', ' ').toUpperCase()}
              </span>
            </div>
          )}
        </div>
      )}

      <ChartLegend items={model.legend} />

      <div className="price-chart-wrap">
        <div ref={containerRef} className="price-chart" />
        {signals?.isWarmingUp && (
          <div className="chart-overlay">
            <span>Warming up geometry with more candles.</span>
          </div>
        )}
        {signals?.isStale && (
          <div className="chart-overlay chart-overlay--danger">
            <span>Live feed is stale. Re-check before entering.</span>
          </div>
        )}
      </div>
    </section>
  )
}

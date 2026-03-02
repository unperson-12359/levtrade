import { useEffect, useRef } from 'react'
import {
  ColorType,
  createChart,
  CrosshairMode,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts'
import { useSignalSeries } from '../../hooks/useSignalSeries'
import type { TrackedCoin } from '../../types/market'
import { SIGNAL_PROVENANCE, type SignalSeriesKind } from '../../utils/provenance'
import { timeAgo } from '../../utils/format'
import { ChartLegend } from '../chart/ChartLegend'

interface VerificationChartProps {
  coin: TrackedCoin
  kind: SignalSeriesKind
  height?: number
}

export function VerificationChart({ coin, kind, height = 220 }: VerificationChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const { series, currentValue, label, unit, lastRefreshedAt, freshness } = useSignalSeries(coin, kind)
  const provenance = SIGNAL_PROVENANCE[kind]

  useEffect(() => {
    if (!containerRef.current) return

    const styles = getComputedStyle(document.documentElement)
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: styles.getPropertyValue('--color-bg-input').trim() },
        textColor: styles.getPropertyValue('--color-text-secondary').trim(),
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
    })

    const lineSeries = chart.addSeries(LineSeries, {
      color: '#3b82f6',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      priceFormat: {
        type: 'custom',
        formatter: (value: number) => `${value.toFixed(2)}${unit}`,
      },
    })

    for (const referenceLine of provenance.referenceLines) {
      lineSeries.createPriceLine({
        price: referenceLine.value,
        color: referenceLine.color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: referenceLine.label,
      })
    }

    chartRef.current = chart
    seriesRef.current = lineSeries

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
      seriesRef.current = null
    }
  }, [coin, height, kind, provenance.referenceLines, unit])

  useEffect(() => {
    if (!seriesRef.current) return
    seriesRef.current.setData(series)
    chartRef.current?.timeScale().fitContent()
  }, [series])

  return (
    <div className="verification-chart">
      <ChartLegend
        items={[
          {
            label,
            value: currentValue !== null ? `${currentValue.toFixed(2)}${unit}` : '--',
            tone: freshnessTone(freshness),
          },
          {
            label: 'Status',
            value: freshnessLabel(freshness),
            tone: freshnessTone(freshness),
          },
          {
            label: 'Updated',
            value: lastRefreshedAt ? timeAgo(lastRefreshedAt) : 'N/A',
            tone: 'muted',
          },
        ]}
      />
      <div ref={containerRef} style={{ width: '100%', height }} />
      {series.length === 0 && (
        <div className="chart-overlay">
          <span>Not enough data for this signal yet.</span>
        </div>
      )}
    </div>
  )
}

function freshnessLabel(freshness: ReturnType<typeof useSignalSeries>['freshness']): string {
  switch (freshness) {
    case 'fresh':
      return 'Fresh'
    case 'stale':
      return 'Stale'
    case 'warming-up':
      return 'Warming Up'
    case 'missing':
      return 'Missing'
  }
}

function freshnessTone(
  freshness: ReturnType<typeof useSignalSeries>['freshness'],
): 'default' | 'muted' | 'green' | 'yellow' | 'red' {
  switch (freshness) {
    case 'fresh':
      return 'green'
    case 'warming-up':
      return 'yellow'
    case 'stale':
      return 'red'
    case 'missing':
      return 'muted'
  }
}

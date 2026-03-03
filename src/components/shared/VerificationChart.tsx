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
import { getSignalProvenance, type SignalSeriesKind } from '../../utils/provenance'
import { useStore } from '../../store'
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
  const hasInitializedViewportRef = useRef(false)
  const userInteractedRef = useRef(false)
  const { series, currentValue, label, unit, lastRefreshedAt, freshness } = useSignalSeries(coin, kind)
  const interval = useStore((s) => s.selectedInterval)
  const provenance = getSignalProvenance(interval)[kind]
  const seriesKey = `${coin}:${kind}`

  useEffect(() => {
    if (!containerRef.current) return

    const styles = getComputedStyle(document.documentElement)
    const container = containerRef.current
    const chart = createChart(containerRef.current, {
      width: container.clientWidth,
      height: container.clientHeight || height,
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
    hasInitializedViewportRef.current = false
    userInteractedRef.current = false

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
      if (hasInitializedViewportRef.current && !userInteractedRef.current) {
        chart.timeScale().fitContent()
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
      seriesRef.current = null
    }
  }, [coin, height, kind, provenance.referenceLines, unit])

  useEffect(() => {
    if (!seriesRef.current) return
    seriesRef.current.setData(series)
    if (!hasInitializedViewportRef.current) {
      chartRef.current?.timeScale().fitContent()
      hasInitializedViewportRef.current = true
      userInteractedRef.current = false
    }
  }, [series, seriesKey])

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

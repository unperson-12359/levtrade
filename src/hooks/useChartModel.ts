import { useMemo } from 'react'
import { LineStyle, type CandlestickData, type LineData, type SeriesMarker, type UTCTimestamp } from 'lightweight-charts'
import { INTERVAL_CONFIG } from '../config/intervals'
import { useStore } from '../store'
import type { Candle, TrackedCoin } from '../types/market'

interface ChartPriceLine {
  title: string
  price: number
  color: string
  lineStyle?: LineStyle
}

interface ChartLegendValue {
  label: string
  value: string
  tone?: 'default' | 'muted' | 'green' | 'yellow' | 'red'
}

export interface ChartModel {
  candles: CandlestickData[]
  meanLine: LineData[]
  upperBandLine: LineData[]
  lowerBandLine: LineData[]
  markers: SeriesMarker<UTCTimestamp>[]
  priceLines: ChartPriceLine[]
  focusRange: { from: UTCTimestamp; to: UTCTimestamp } | null
  latestClose: number | null
  legend: ChartLegendValue[]
  isWarmingUp: boolean
  isStale: boolean
}

interface ChartModelOptions {
  candlesOverride?: Candle[] | null
}

const BOLLINGER_PERIOD = 20
const DEFAULT_VIEWPORT_BARS = 120

export function useChartModel(coin: TrackedCoin, options?: ChartModelOptions): ChartModel {
  const candles = useStore((state) => state.candles[coin])
  const lastUpdate = useStore((state) => state.lastUpdate)
  const connectionStatus = useStore((state) => state.connectionStatus)
  const selectedInterval = useStore((state) => state.selectedInterval)
  const sourceCandles = options?.candlesOverride ?? candles

  return useMemo(() => {
    if (!sourceCandles || sourceCandles.length === 0) {
      return {
        candles: [],
        meanLine: [],
        upperBandLine: [],
        lowerBandLine: [],
        markers: [],
        priceLines: [],
        focusRange: null,
        latestClose: null,
        legend: [],
        isWarmingUp: true,
        isStale: true,
      }
    }

    const candleData: CandlestickData[] = sourceCandles.map((candle) => ({
      time: Math.floor(candle.time / 1000) as UTCTimestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }))

    const meanLine: LineData[] = []
    const upperBandLine: LineData[] = []
    const lowerBandLine: LineData[] = []

    for (let index = BOLLINGER_PERIOD - 1; index < sourceCandles.length; index += 1) {
      const window = sourceCandles.slice(index - BOLLINGER_PERIOD + 1, index + 1)
      const mean = window.reduce((sum, candle) => sum + candle.close, 0) / window.length
      const variance = window.reduce((sum, candle) => sum + (candle.close - mean) ** 2, 0) / window.length
      const stddev = Math.sqrt(variance)
      const time = Math.floor(sourceCandles[index]!.time / 1000) as UTCTimestamp

      meanLine.push({ time, value: mean })
      upperBandLine.push({ time, value: mean + stddev * 2 })
      lowerBandLine.push({ time, value: mean - stddev * 2 })
    }

    const latestClose = sourceCandles[sourceCandles.length - 1]?.close ?? null
    const previousClose = sourceCandles[sourceCandles.length - 2]?.close ?? null
    const barsFor24h = selectedInterval === '1d' ? 1 : 6
    const close24hAgo = sourceCandles[Math.max(0, sourceCandles.length - 1 - barsFor24h)]?.close ?? null
    const latestMean = meanLine[meanLine.length - 1]?.value ?? null
    const latestUpper = upperBandLine[upperBandLine.length - 1]?.value ?? null
    const latestLower = lowerBandLine[lowerBandLine.length - 1]?.value ?? null

    const priceLines: ChartPriceLine[] = []
    if (latestClose !== null) {
      priceLines.push({
        title: 'Last',
        price: latestClose,
        color: 'var(--color-chart-price)',
      })
    }
    if (latestMean !== null) {
      priceLines.push({
        title: 'Mean',
        price: latestMean,
        color: 'rgba(212, 168, 83, 0.85)',
        lineStyle: LineStyle.Dashed,
      })
    }

    const focusStartIndex = Math.max(0, candleData.length - DEFAULT_VIEWPORT_BARS)
    const focusRange = candleData.length > 1
      ? {
          from: candleData[focusStartIndex]!.time as UTCTimestamp,
          to: candleData[candleData.length - 1]!.time as UTCTimestamp,
        }
      : null

    const intervalChangePct =
      latestClose !== null && previousClose !== null && previousClose !== 0
        ? ((latestClose - previousClose) / Math.abs(previousClose)) * 100
        : null
    const change24hPct =
      latestClose !== null && close24hAgo !== null && close24hAgo !== 0
        ? ((latestClose - close24hAgo) / Math.abs(close24hAgo)) * 100
        : null
    const meanGapPct =
      latestClose !== null && latestMean !== null && latestMean !== 0
        ? ((latestClose - latestMean) / Math.abs(latestMean)) * 100
        : null
    const bandWidthPct =
      latestUpper !== null && latestLower !== null && latestMean !== null && latestMean !== 0
        ? ((latestUpper - latestLower) / Math.abs(latestMean)) * 100
        : null

    const legend: ChartLegendValue[] = []
    if (latestClose !== null) {
      legend.push({ label: 'Last', value: latestClose.toFixed(2) })
    }
    if (intervalChangePct !== null) {
      legend.push({
        label: selectedInterval === '1d' ? '1d move' : 'Bar move',
        value: formatPercent(intervalChangePct),
        tone: toneFromSignedPercent(intervalChangePct),
      })
    }
    if (change24hPct !== null) {
      legend.push({
        label: '24h move',
        value: formatPercent(change24hPct),
        tone: toneFromSignedPercent(change24hPct),
      })
    }
    if (meanGapPct !== null) {
      legend.push({
        label: 'Mean gap',
        value: formatPercent(meanGapPct),
        tone: toneFromSignedPercent(meanGapPct),
      })
    }
    if (bandWidthPct !== null) {
      legend.push({
        label: 'Band width',
        value: `${bandWidthPct.toFixed(1)}%`,
        tone: bandWidthPct >= 8 ? 'yellow' : 'muted',
      })
    }

    const latestCandleTime = sourceCandles[sourceCandles.length - 1]?.time ?? null
    const intervalConfig = INTERVAL_CONFIG[selectedInterval]
    const ageMs = latestCandleTime === null ? Number.POSITIVE_INFINITY : Date.now() - latestCandleTime
    const isWarmingUp = sourceCandles.length < BOLLINGER_PERIOD
    const isStale = options?.candlesOverride
      ? false
      : connectionStatus === 'error' ||
        connectionStatus === 'disconnected' ||
        lastUpdate === null ||
        Date.now() - lastUpdate > intervalConfig.staleAfterMs ||
        ageMs > intervalConfig.staleAfterMs

    return {
      candles: candleData,
      meanLine,
      upperBandLine,
      lowerBandLine,
      markers: [],
      priceLines,
      focusRange,
      latestClose,
      legend,
      isWarmingUp,
      isStale,
    }
  }, [connectionStatus, lastUpdate, options?.candlesOverride, selectedInterval, sourceCandles])
}

function toneFromSignedPercent(value: number): ChartLegendValue['tone'] {
  if (value > 0) return 'green'
  if (value < 0) return 'red'
  return 'muted'
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

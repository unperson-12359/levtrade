import { useMemo } from 'react'
import type { CandlestickData, LineData, LineStyle, SeriesMarker, UTCTimestamp } from 'lightweight-charts'
import { useStore } from '../store'
import { usePositionRisk } from './usePositionRisk'
import type { Candle, TrackedCoin } from '../types/market'
import type { SuggestedSetup } from '../types/setup'

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
}

interface ChartModelOptions {
  candlesOverride?: Candle[] | null
  reviewMode?: 'live' | 'historical'
}

export function useChartModel(
  coin: TrackedCoin,
  verificationSetup?: SuggestedSetup | null,
  options?: ChartModelOptions,
): ChartModel {
  const candles = useStore((s) => s.candles[coin])
  const signals = useStore((s) => s.signals[coin])
  const { inputs, outputs } = usePositionRisk()
  const sourceCandles = options?.candlesOverride ?? candles
  const isHistoricalReview = options?.reviewMode === 'historical'

  return useMemo(() => {
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
    const BOLLINGER_PERIOD = 20
    const windowSize = BOLLINGER_PERIOD

    for (let index = windowSize - 1; index < sourceCandles.length; index++) {
      const window = sourceCandles.slice(index - windowSize + 1, index + 1)
      const mean = window.reduce((sum, candle) => sum + candle.close, 0) / window.length
      const variance = window.reduce((sum, candle) => sum + (candle.close - mean) ** 2, 0) / window.length
      const stddev = Math.sqrt(variance)
      const time = Math.floor(sourceCandles[index]!.time / 1000) as UTCTimestamp

      meanLine.push({ time, value: mean })
      upperBandLine.push({ time, value: mean + stddev * 2 })
      lowerBandLine.push({ time, value: mean - stddev * 2 })
    }

    const latestClose = sourceCandles.length > 0 ? sourceCandles[sourceCandles.length - 1]!.close : null
    const markers: SeriesMarker<UTCTimestamp>[] = []
    const priceLines: ChartPriceLine[] = []
    let focusRange: { from: UTCTimestamp; to: UTCTimestamp } | null = null

    if (latestClose !== null) {
      priceLines.push({
        title: isHistoricalReview ? 'Now' : 'Last',
        price: latestClose,
        color: 'var(--color-chart-price)',
      })
    }

    if (verificationSetup) {
      const triggerMarkerTime = getTriggerMarkerTime(sourceCandles, verificationSetup.generatedAt)
      if (triggerMarkerTime !== null) {
        markers.push({
          time: triggerMarkerTime,
          position: 'aboveBar',
          shape: 'circle',
          color: '#60a5fa',
          text: isHistoricalReview ? 'Suggested' : 'Setup',
        })
      }

      priceLines.push(
        {
          title: 'Entry',
          price: verificationSetup.entryPrice,
          color: 'var(--color-chart-price)',
        },
        {
          title: 'Setup Stop',
          price: verificationSetup.stopPrice,
          color: 'var(--color-signal-red)',
        },
        {
          title: 'Setup Target',
          price: verificationSetup.targetPrice,
          color: 'var(--color-signal-green)',
        },
        {
          title: 'Mean',
          price: verificationSetup.meanReversionTarget,
          color: 'var(--color-signal-blue)',
          lineStyle: 2,
        },
      )
    } else if (inputs.coin === coin && outputs && !outputs.hasInputError) {
      priceLines.push(
        {
          title: outputs.usedCustomStop ? 'Custom Stop' : 'Auto Stop',
          price: outputs.effectiveStopPrice,
          color: 'var(--color-signal-red)',
        },
        {
          title: outputs.usedCustomTarget ? 'Custom Target' : 'Auto Target',
          price: outputs.effectiveTargetPrice,
          color: 'var(--color-signal-green)',
        },
      )

      if (outputs.hasLiquidation) {
        priceLines.push({
          title: 'Liq',
          price: outputs.liquidationPrice,
          color: 'var(--color-signal-yellow)',
          lineStyle: 2,
        })
      } else if (outputs.liquidationPriceAtMinLeverage !== null) {
        priceLines.push({
          title: `Liq @ ${outputs.minLeverageForLiquidation?.toFixed(1)}x`,
          price: outputs.liquidationPriceAtMinLeverage,
          color: 'var(--color-signal-yellow)',
          lineStyle: 2,
        })
      }
    }

    if (verificationSetup && candleData.length > 1) {
      const availableFrom = candleData[0]!.time as UTCTimestamp
      const availableTo = candleData[candleData.length - 1]!.time as UTCTimestamp

      if (isHistoricalReview) {
        focusRange = {
          from: availableFrom,
          to: availableTo,
        }
      } else {
        const focusTime = Math.floor(verificationSetup.generatedAt / 1000) as UTCTimestamp
        const defaultFrom = Math.max(availableFrom, focusTime - 36 * 60 * 60) as UTCTimestamp
        const defaultTo = Math.min(availableTo, focusTime + 24 * 60 * 60) as UTCTimestamp

        if (defaultFrom < defaultTo) {
          focusRange = {
            from: defaultFrom,
            to: defaultTo,
          }
        }
      }
    }

    const legend: ChartLegendValue[] = []
    if (latestClose !== null) {
      legend.push({ label: isHistoricalReview ? 'Now' : 'Last', value: latestClose.toFixed(2) })
    }
    if (isHistoricalReview && verificationSetup) {
      legend.push(
        {
          label: 'Stretch',
          value: `${verificationSetup.stretchSigma.toFixed(2)} sig`,
          tone: verificationSetup.tradeGrade,
        },
        {
          label: 'ATR Drift',
          value: `${verificationSetup.atr.toFixed(2)} ATR`,
          tone: 'yellow',
        },
        {
          label: 'Composite',
          value: `${verificationSetup.compositeValue.toFixed(2)} ${verificationSetup.direction.toUpperCase()}`,
          tone: verificationSetup.tradeGrade,
        },
        {
          label: 'Suggested',
          value: formatLegendTimestamp(verificationSetup.generatedAt),
          tone: 'muted',
        },
      )
    } else if (signals) {
      legend.push(
        {
          label: 'Stretch',
          value: `${signals.entryGeometry.stretchZEquivalent.toFixed(2)} sig`,
          tone: signals.entryGeometry.color,
        },
        {
          label: 'ATR Drift',
          value: `${signals.entryGeometry.atrDislocation.toFixed(2)} ATR`,
          tone: signals.entryGeometry.color,
        },
        {
          label: 'Composite',
          value: signals.composite.label,
          tone: signals.composite.color,
        },
      )
    }

    if (verificationSetup) {
      legend.push(
        {
          label: 'Entry',
          value: verificationSetup.entryPrice.toFixed(2),
          tone: 'default',
        },
        {
          label: 'Stop',
          value: verificationSetup.stopPrice.toFixed(2),
          tone: 'red',
        },
        {
          label: 'Target',
          value: verificationSetup.targetPrice.toFixed(2),
          tone: 'green',
        },
      )
    } else if (inputs.coin === coin && outputs && !outputs.hasInputError) {
      legend.push(
        {
          label: 'Stop',
          value: outputs.effectiveStopPrice.toFixed(2),
          tone: 'red',
        },
        {
          label: 'Target',
          value: outputs.effectiveTargetPrice.toFixed(2),
          tone: 'green',
        },
      )

      if (outputs.effectiveImmune && outputs.minLeverageForLiquidation !== null) {
        legend.push({
          label: 'Liq Starts',
          value: `${outputs.minLeverageForLiquidation.toFixed(1)}x`,
          tone: 'yellow',
        })
      }
    }

    return {
      candles: candleData,
      meanLine,
      upperBandLine,
      lowerBandLine,
      markers,
      priceLines,
      focusRange,
      latestClose,
      legend,
    }
  }, [coin, inputs.coin, isHistoricalReview, outputs, signals, sourceCandles, verificationSetup])
}

function getTriggerMarkerTime(candles: Candle[], generatedAt: number): UTCTimestamp | null {
  if (candles.length === 0) {
    return null
  }

  const candidate =
    candles.find((candle) => candle.time >= generatedAt) ??
    [...candles].reverse().find((candle) => candle.time <= generatedAt) ??
    candles[0]

  if (!candidate) {
    return null
  }

  return Math.floor(candidate.time / 1000) as UTCTimestamp
}

function formatLegendTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

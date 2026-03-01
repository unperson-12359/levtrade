import { useMemo } from 'react'
import type { CandlestickData, LineData, LineStyle, UTCTimestamp } from 'lightweight-charts'
import { useStore } from '../store'
import { usePositionRisk } from './usePositionRisk'
import type { TrackedCoin } from '../types/market'

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
  priceLines: ChartPriceLine[]
  latestClose: number | null
  legend: ChartLegendValue[]
}

export function useChartModel(coin: TrackedCoin): ChartModel {
  const candles = useStore((s) => s.candles[coin])
  const signals = useStore((s) => s.signals[coin])
  const { inputs, outputs } = usePositionRisk()

  return useMemo(() => {
    const candleData: CandlestickData[] = candles.map((candle) => ({
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

    for (let index = windowSize - 1; index < candles.length; index++) {
      const window = candles.slice(index - windowSize + 1, index + 1)
      const mean = window.reduce((sum, candle) => sum + candle.close, 0) / window.length
      const variance = window.reduce((sum, candle) => sum + (candle.close - mean) ** 2, 0) / window.length
      const stddev = Math.sqrt(variance)
      const time = Math.floor(candles[index]!.time / 1000) as UTCTimestamp

      meanLine.push({ time, value: mean })
      upperBandLine.push({ time, value: mean + stddev * 2 })
      lowerBandLine.push({ time, value: mean - stddev * 2 })
    }

    const latestClose = candles.length > 0 ? candles[candles.length - 1]!.close : null
    const priceLines: ChartPriceLine[] = []

    if (latestClose !== null) {
      priceLines.push({
        title: 'Last',
        price: latestClose,
        color: 'var(--color-chart-price)',
      })
    }

    if (inputs.coin === coin && outputs && !outputs.hasInputError) {
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

    const legend: ChartLegendValue[] = []
    if (latestClose !== null) {
      legend.push({ label: 'Last', value: latestClose.toFixed(2) })
    }
    if (signals) {
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

    if (inputs.coin === coin && outputs && !outputs.hasInputError) {
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
      priceLines,
      latestClose,
      legend,
    }
  }, [candles, coin, inputs.coin, outputs, signals])
}

import type { Candle, FundingSnapshot, OISnapshot, TrackedCoin } from '../types/market'
import type {
  CandleHitCluster,
  CorrelationEdge,
  IndicatorBarState,
  IndicatorHealth,
  IndicatorHealthWarning,
  IndicatorHitEvent,
  IndicatorCategory,
  IndicatorMetric,
  IndicatorSeriesPoint,
  IndicatorStateRecord,
  IndicatorState,
  ObservatorySnapshot,
  QuantileBucket,
} from './types'

type Interval = '1h' | '4h' | '1d'
type Series = Array<number | null>

interface BuildInput {
  coin: TrackedCoin
  interval: Interval
  candles: Candle[]
  fundingHistory: FundingSnapshot[]
  oiHistory: OISnapshot[]
}

interface MetricSeed {
  id: string
  label: string
  category: IndicatorCategory
  unit: string
  description: string
  values: Series
  classify: (value: number) => IndicatorState
}

interface HydratedMetric {
  metric: IndicatorMetric
  stateSeries: Array<IndicatorState | null>
}

const BOUNDED_RANGES: Record<string, { min: number; max: number; tolerance?: number }> = {
  momentum_rsi14: { min: 0, max: 100 },
  momentum_stoch_k14: { min: 0, max: 100 },
  momentum_stoch_d14: { min: 0, max: 100 },
  momentum_williams_r14: { min: -100, max: 0 },
  volume_mfi14: { min: 0, max: 100 },
  structure_donchian_pos_20: { min: 0, max: 1 },
  volatility_bb_percent_b: { min: -0.5, max: 1.5, tolerance: 0.05 },
  volatility_adx14: { min: 0, max: 100 },
  volatility_plus_di14: { min: 0, max: 100 },
  volatility_minus_di14: { min: 0, max: 100 },
}

export function buildObservatorySnapshot(input: BuildInput): ObservatorySnapshot {
  const candles = input.candles
  if (candles.length === 0) {
    return {
      coin: input.coin,
      interval: input.interval,
      generatedAt: Date.now(),
      candleCount: 0,
      indicators: [],
      edges: [],
      timeline: [],
      barStates: [],
      health: {
        status: 'healthy',
        total: 0,
        valid: 0,
        warnings: [],
      },
    }
  }

  const times = candles.map((candle) => candle.time)
  const opens = candles.map((candle) => candle.open)
  const highs = candles.map((candle) => candle.high)
  const lows = candles.map((candle) => candle.low)
  const closes = candles.map((candle) => candle.close)
  const volumes = candles.map((candle) => candle.volume)
  const trades = candles.map((candle) => candle.trades)
  const intervalHours = intervalToHours(input.interval)

  const sma5 = smaSeries(closes, 5)
  const sma20 = smaSeries(closes, 20)
  const sma50 = smaSeries(closes, 50)
  const sma100 = smaSeries(closes, 100)
  const ema8 = emaSeries(closes, 8)
  const ema21 = emaSeries(closes, 21)
  const ema55 = emaSeries(closes, 55)
  const rsi14 = rsiSeries(closes, 14)
  const stoch = stochasticSeries(highs, lows, closes, 14, 3)
  const macd = macdSeries(closes, 12, 26, 9)
  const atr14 = atrSeries(candles, 14)
  const atr14Pct = ratioSeries(atr14, closes, 100)
  const roc10 = pctChangeSeries(closes, 10)
  const roc24 = pctChangeSeries(closes, 24)
  const momentum10 = momentumPctSeries(closes, 10)
  const cci20 = cciSeries(candles, 20)
  const williamsR14 = williamsRSeries(highs, lows, closes, 14)
  const mfi14 = mfiSeries(candles, 14)
  const cmf20 = cmfSeries(candles, 20)
  const obv = obvSeries(candles)
  const obvSlope20 = pctChangeSeries(obv, 20)
  const bb = bollingerSeries(closes, 20, 2)
  const donchianPos20 = donchianPositionSeries(highs, lows, closes, 20)
  const keltnerPos20 = keltnerPositionSeries(closes, ema21, atr14)
  const vwapDeviation = vwapDeviationSeries(opens, highs, lows, closes, volumes)
  const realizedVol20 = realizedVolSeries(closes, 20, intervalHours)
  const range14Pct = highLowRangePctSeries(highs, lows, closes, 14)
  const volumeZ20 = zScoreSeries(wrapNumericSeries(volumes), 20)
  const tradesZ20 = zScoreSeries(wrapNumericSeries(trades), 20)
  const adx = adxSeries(candles, 14)
  const priceChange1Bar = pctChangeSeries(closes, 1)
  const priceChange24h = pctChangeSeries(closes, Math.max(1, Math.round(24 / intervalHours)))

  const seeds: MetricSeed[] = [
    makeMetric(
      'trend_sma_5_20_spread',
      'SMA 5/20 Spread',
      'Trend',
      '%',
      'Short-term slope of price relative to the medium trend.',
      ratioDiffSeries(sma5, sma20, 100),
      signedState(0.4),
    ),
    makeMetric(
      'trend_sma_20_50_spread',
      'SMA 20/50 Spread',
      'Trend',
      '%',
      'Medium trend differential between 20 and 50 bars.',
      ratioDiffSeries(sma20, sma50, 100),
      signedState(0.6),
    ),
    makeMetric(
      'trend_sma_50_100_spread',
      'SMA 50/100 Spread',
      'Trend',
      '%',
      'Long trend slope from medium to major trend baseline.',
      ratioDiffSeries(sma50, sma100, 100),
      signedState(0.9),
    ),
    makeMetric(
      'trend_ema_8_21_spread',
      'EMA 8/21 Spread',
      'Trend',
      '%',
      'Fast trend acceleration against the core EMA baseline.',
      ratioDiffSeries(ema8, ema21, 100),
      signedState(0.35),
    ),
    makeMetric(
      'trend_ema_21_55_spread',
      'EMA 21/55 Spread',
      'Trend',
      '%',
      'Intermediate trend pressure from momentum to structure.',
      ratioDiffSeries(ema21, ema55, 100),
      signedState(0.45),
    ),
    makeMetric(
      'trend_price_vs_sma20',
      'Price vs SMA20',
      'Trend',
      '%',
      'Current price distance from the 20-bar mean.',
      ratioDiffSeries(wrapNumericSeries(closes), sma20, 100),
      signedState(0.8),
    ),
    makeMetric(
      'trend_price_vs_ema21',
      'Price vs EMA21',
      'Trend',
      '%',
      'Current price distance from the 21-bar EMA anchor.',
      ratioDiffSeries(wrapNumericSeries(closes), ema21, 100),
      signedState(0.7),
    ),
    makeMetric(
      'structure_donchian_pos_20',
      'Donchian Position 20',
      'Structure',
      '0-1',
      'Position of price between 20-bar range low and high.',
      donchianPos20,
      bandState(0.2, 0.8),
    ),
    makeMetric(
      'structure_keltner_pos_20',
      'Keltner Position',
      'Structure',
      'xATR',
      'Price distance from EMA21 expressed in ATR units.',
      keltnerPos20,
      signedState(0.8),
    ),
    makeMetric(
      'structure_vwap_dev',
      'VWAP Deviation',
      'Structure',
      '%',
      'Distance of close from cumulative VWAP.',
      vwapDeviation,
      signedState(0.6),
    ),
    makeMetric(
      'momentum_rsi14',
      'RSI 14',
      'Momentum',
      '',
      'Relative strength momentum oscillator.',
      rsi14,
      bandState(30, 70),
    ),
    makeMetric(
      'momentum_stoch_k14',
      'Stochastic K 14',
      'Momentum',
      '',
      'Close position in rolling 14-bar high-low range.',
      stoch.k,
      bandState(20, 80),
    ),
    makeMetric(
      'momentum_stoch_d14',
      'Stochastic D 14',
      'Momentum',
      '',
      'Smoothed stochastic momentum signal line.',
      stoch.d,
      bandState(20, 80),
    ),
    makeMetric(
      'momentum_macd_line_pct',
      'MACD Line',
      'Momentum',
      '%',
      'Normalized MACD line relative to close price.',
      ratioSeries(macd.line, closes, 100),
      signedState(0.15),
    ),
    makeMetric(
      'momentum_macd_signal_pct',
      'MACD Signal',
      'Momentum',
      '%',
      'Normalized MACD signal line relative to close price.',
      ratioSeries(macd.signal, closes, 100),
      signedState(0.15),
    ),
    makeMetric(
      'momentum_macd_hist_pct',
      'MACD Histogram',
      'Momentum',
      '%',
      'Momentum spread between MACD line and signal line.',
      ratioSeries(macd.histogram, closes, 100),
      signedState(0.08),
    ),
    makeMetric(
      'momentum_roc_10',
      'ROC 10',
      'Momentum',
      '%',
      '10-bar percentage rate of change.',
      roc10,
      signedState(1),
    ),
    makeMetric(
      'momentum_roc_24',
      'ROC 24 Bars',
      'Momentum',
      '%',
      '24-bar percentage rate of change.',
      roc24,
      signedState(1.4),
    ),
    makeMetric(
      'momentum_mom_10',
      'Momentum 10',
      'Momentum',
      '%',
      '10-bar momentum amplitude.',
      momentum10,
      signedState(1),
    ),
    makeMetric(
      'momentum_williams_r14',
      'Williams %R 14',
      'Momentum',
      '',
      'Momentum oscillator normalized between -100 and 0.',
      williamsR14,
      bandState(-80, -20),
    ),
    makeMetric(
      'momentum_cci20',
      'CCI 20',
      'Momentum',
      '',
      'Commodity channel momentum against its mean deviation.',
      cci20,
      signedState(100),
    ),
    makeMetric(
      'volatility_atr14_pct',
      'ATR 14',
      'Volatility',
      '%',
      'Average true range as percentage of close.',
      atr14Pct,
      bandState(1.2, 4.5),
    ),
    makeMetric(
      'volatility_realized_20',
      'Realized Vol 20',
      'Volatility',
      '%',
      '20-bar annualized realized volatility.',
      realizedVol20,
      bandState(30, 90),
    ),
    makeMetric(
      'volatility_bb_percent_b',
      'Bollinger %B',
      'Volatility',
      '',
      'Relative location inside Bollinger envelope.',
      bb.percentB,
      bandState(0.15, 0.85),
    ),
    makeMetric(
      'volatility_bb_width',
      'Bollinger Width',
      'Volatility',
      '%',
      'Width of Bollinger bands vs middle band.',
      bb.widthPct,
      bandState(2, 16),
    ),
    makeMetric(
      'volatility_range14',
      'Range 14',
      'Volatility',
      '%',
      'Average high-low range over 14 bars.',
      range14Pct,
      bandState(1.3, 5),
    ),
    makeMetric(
      'volatility_adx14',
      'ADX 14',
      'Volatility',
      '',
      'Directional trend strength regardless of side.',
      adx.adx,
      bandState(18, 35),
    ),
    makeMetric(
      'volatility_plus_di14',
      '+DI 14',
      'Volatility',
      '',
      'Positive directional movement indicator.',
      adx.plusDI,
      bandState(18, 35),
    ),
    makeMetric(
      'volatility_minus_di14',
      '-DI 14',
      'Volatility',
      '',
      'Negative directional movement indicator.',
      adx.minusDI,
      bandState(18, 35),
    ),
    makeMetric(
      'volume_obv_slope20',
      'OBV Slope 20',
      'Volume',
      '%',
      'On-balance-volume trend velocity over 20 bars.',
      obvSlope20,
      signedState(1.2),
    ),
    makeMetric(
      'volume_cmf20',
      'CMF 20',
      'Volume',
      '',
      'Chaikin money flow over 20 bars.',
      cmf20,
      signedState(0.08),
    ),
    makeMetric(
      'volume_mfi14',
      'MFI 14',
      'Volume',
      '',
      'Volume-weighted momentum oscillator.',
      mfi14,
      bandState(30, 70),
    ),
    makeMetric(
      'volume_z20',
      'Volume Z 20',
      'Volume',
      'z',
      'Relative deviation of volume from 20-bar baseline.',
      volumeZ20,
      signedState(1),
    ),
    makeMetric(
      'volume_trades_z20',
      'Trades Z 20',
      'Volume',
      'z',
      'Relative deviation of trade count from 20-bar baseline.',
      tradesZ20,
      signedState(1),
    ),
    makeMetric(
      'momentum_price_change_1h',
      'Price Change 1 Bar',
      'Momentum',
      '%',
      'Single-bar return for local acceleration mapping.',
      priceChange1Bar,
      signedState(0.8),
    ),
    makeMetric(
      'momentum_price_change_24h',
      'Price Change 24h',
      'Momentum',
      '%',
      '24-hour equivalent return for regime drift mapping.',
      priceChange24h,
      signedState(2),
    ),
  ]

  const hydrated = seeds
    .map((seed) => hydrateMetric(seed, times))
    .filter((entry) => entry.metric.series.length > 25)

  const indicators = hydrated.map((entry) => entry.metric)
  const edges = computeCorrelationEdges(indicators, 12)
  const timeline = buildHitTimeline(hydrated, candles, input.interval, 3)
  const barStates = buildIndicatorBarStates(hydrated, times)
  const health = computeIndicatorHealth(indicators)

  return {
    coin: input.coin,
    interval: input.interval,
    generatedAt: Date.now(),
    candleCount: candles.length,
    indicators,
    edges,
    timeline,
    barStates,
    health,
  }
}

function buildIndicatorBarStates(hydratedMetrics: HydratedMetric[], times: number[]): IndicatorBarState[] {
  return times.map((time, index) => {
    const laneCounts: Partial<Record<IndicatorCategory, number>> = {}
    const activeIndicatorIds: string[] = []

    for (const entry of hydratedMetrics) {
      const state = entry.stateSeries[index]
      if (!state || state === 'neutral') continue

      activeIndicatorIds.push(entry.metric.id)
      laneCounts[entry.metric.category] = (laneCounts[entry.metric.category] ?? 0) + 1
    }

    return {
      time,
      activeCount: activeIndicatorIds.length,
      laneCounts,
      activeIndicatorIds,
    }
  })
}

export function buildIndicatorStateRecords(snapshot: ObservatorySnapshot): IndicatorStateRecord[] {
  const categories = new Map(snapshot.indicators.map((indicator) => [indicator.id, indicator.category]))

  return snapshot.barStates.flatMap((barState) => {
    const activeIndicators = new Set(barState.activeIndicatorIds)
    return snapshot.indicators.map<IndicatorStateRecord>((indicator) => ({
      id: `${snapshot.coin}:${snapshot.interval}:${barState.time}:${indicator.id}`,
      coin: snapshot.coin,
      interval: snapshot.interval,
      candleTime: barState.time,
      indicatorId: indicator.id,
      category: categories.get(indicator.id) ?? indicator.category,
      isOn: activeIndicators.has(indicator.id),
    }))
  })
}

function hydrateMetric(seed: MetricSeed, times: number[]): HydratedMetric {
  const series: IndicatorSeriesPoint[] = []
  const stateSeries: Array<IndicatorState | null> = Array(seed.values.length).fill(null)

  for (let index = 0; index < seed.values.length; index += 1) {
    const value = seed.values[index]
    if (!isFiniteNumber(value)) continue
    const time = times[index]
    if (typeof time !== 'number') continue
    stateSeries[index] = seed.classify(value)
    series.push({ time, value })
  }

  const currentValue = series.length > 0 ? series[series.length - 1]!.value : null
  const currentState = currentValue === null ? 'neutral' : seed.classify(currentValue)
  const quantiles = computeQuantileStats(series.map((point) => point.value), currentValue)
  const frequency = computeFrequency(seed.values, quantiles.thresholds, seed.classify)

  return {
    metric: {
      id: seed.id,
      label: seed.label,
      category: seed.category,
      unit: seed.unit,
      description: seed.description,
      currentValue,
      currentState,
      quantileRank: quantiles.currentRank,
      quantileBucket: quantiles.currentBucket,
      series,
      rawValues: seed.values,
      frequency,
    },
    stateSeries,
  }
}

function computeCorrelationEdges(indicators: IndicatorMetric[], maxLagBars: number): CorrelationEdge[] {
  const edges: CorrelationEdge[] = []

  for (let left = 0; left < indicators.length; left += 1) {
    const a = indicators[left]
    if (!a) continue
    for (let right = left + 1; right < indicators.length; right += 1) {
      const b = indicators[right]
      if (!b) continue

      const valuesA = a.rawValues ?? []
      const valuesB = b.rawValues ?? []
      const paired = pairSeries(valuesA, valuesB, 40)
      if (!paired) continue

      const pearson = pearsonCorrelation(paired.x, paired.y)
      const spearman = spearmanCorrelation(paired.x, paired.y)
      const lag = bestLagCorrelation(valuesA, valuesB, maxLagBars, 40)
      const strength = (Math.abs(pearson) + Math.abs(spearman) + Math.abs(lag.correlation)) / 3

      if (!isFiniteNumber(strength) || strength < 0.25) continue

      edges.push({
        a: a.id,
        b: b.id,
        pearson,
        spearman,
        lagBars: lag.bars,
        lagCorrelation: lag.correlation,
        sampleSize: paired.x.length,
        strength,
      })
    }
  }

  return edges.sort((x, y) => y.strength - x.strength).slice(0, 220)
}

function computeIndicatorHealth(indicators: IndicatorMetric[]): IndicatorHealth {
  if (indicators.length === 0) {
    return {
      status: 'healthy',
      total: 0,
      valid: 0,
      warnings: [],
    }
  }

  const warnings: IndicatorHealthWarning[] = []
  const warnedIndicators = new Set<string>()
  const seenWarnings = new Set<string>()

  const pushWarning = (
    indicator: IndicatorMetric,
    kind: IndicatorHealthWarning['kind'],
    message: string,
  ) => {
    const key = `${indicator.id}:${kind}:${message}`
    if (seenWarnings.has(key)) return
    seenWarnings.add(key)
    warnedIndicators.add(indicator.id)
    warnings.push({
      indicatorId: indicator.id,
      indicatorLabel: indicator.label,
      kind,
      message,
    })
  }

  for (const indicator of indicators) {
    const rawValues = indicator.rawValues ?? []
    const finiteValues = rawValues.filter((value): value is number => isFiniteNumber(value))
    const totalSamples = rawValues.length
    const finiteSamples = finiteValues.length

    if (finiteSamples < 30) {
      pushWarning(indicator, 'insufficient_data', `Only ${finiteSamples} valid samples available.`)
    }

    if (totalSamples > 0) {
      const coverage = finiteSamples / totalSamples
      if (coverage < 0.55) {
        pushWarning(indicator, 'insufficient_data', `Coverage ${(coverage * 100).toFixed(0)}% below 55%.`)
      }
    }

    if (finiteValues.length >= 20) {
      const scale = computeSeriesScale(rawValues)
      if (scale < 1e-9) {
        pushWarning(indicator, 'flatline', 'Series is nearly flat and may not carry signal information.')
      }
    }

    const bounds = BOUNDED_RANGES[indicator.id]
    if (!bounds || finiteValues.length === 0) continue

    const minValue = Math.min(...finiteValues)
    const maxValue = Math.max(...finiteValues)
    const tolerance = bounds.tolerance ?? 0
    if (minValue < bounds.min - tolerance || maxValue > bounds.max + tolerance) {
      pushWarning(
        indicator,
        'range_violation',
        `Observed range ${minValue.toFixed(2)}..${maxValue.toFixed(2)} outside expected ${bounds.min}..${bounds.max}.`,
      )
    }
  }

  const valid = Math.max(0, indicators.length - warnedIndicators.size)
  const validRatio = indicators.length > 0 ? valid / indicators.length : 1
  const status: IndicatorHealth['status'] =
    warnings.length === 0 ? 'healthy' : validRatio >= 0.85 ? 'warning' : 'critical'

  return {
    status,
    total: indicators.length,
    valid,
    warnings: warnings.slice(0, 32),
  }
}

function makeMetric(
  id: string,
  label: string,
  category: IndicatorCategory,
  unit: string,
  description: string,
  values: Series,
  classify: (value: number) => IndicatorState,
): MetricSeed {
  return {
    id,
    label,
    category,
    unit,
    description,
    values,
    classify,
  }
}

function signedState(threshold: number) {
  return (value: number): IndicatorState => {
    if (value >= threshold) return 'high'
    if (value <= -threshold) return 'low'
    return 'neutral'
  }
}

function bandState(low: number, high: number) {
  return (value: number): IndicatorState => {
    if (value >= high) return 'high'
    if (value <= low) return 'low'
    return 'neutral'
  }
}

function intervalToHours(interval: Interval): number {
  if (interval === '1h') return 1
  if (interval === '4h') return 4
  return 24
}

function intervalToMs(interval: Interval): number {
  if (interval === '1h') return 60 * 60 * 1000
  if (interval === '4h') return 4 * 60 * 60 * 1000
  return 24 * 60 * 60 * 1000
}

function wrapNumericSeries(values: number[]): Series {
  return values.map((value) => (isFiniteNumber(value) ? value : null))
}

function smaSeries(values: number[], period: number): Series {
  const output: Series = Array(values.length).fill(null)
  if (period <= 1) return wrapNumericSeries(values)
  let rollingSum = 0
  for (let index = 0; index < values.length; index += 1) {
    rollingSum += values[index] ?? 0
    if (index >= period) {
      rollingSum -= values[index - period] ?? 0
    }
    if (index >= period - 1) {
      output[index] = rollingSum / period
    }
  }
  return output
}

function emaSeries(values: number[], period: number): Series {
  const output: Series = Array(values.length).fill(null)
  if (values.length === 0) return output

  const alpha = 2 / (period + 1)
  let prev = values[0] ?? 0
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index] ?? prev
    prev = index === 0 ? value : (value * alpha) + (prev * (1 - alpha))
    if (index >= period - 1) {
      output[index] = prev
    }
  }
  return output
}

function rollingStdSeries(values: number[], period: number): Series {
  const output: Series = Array(values.length).fill(null)
  for (let index = period - 1; index < values.length; index += 1) {
    let sum = 0
    let sumSquares = 0
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      const value = values[cursor] ?? 0
      sum += value
      sumSquares += value * value
    }
    const mean = sum / period
    const variance = Math.max(0, (sumSquares / period) - (mean * mean))
    output[index] = Math.sqrt(variance)
  }
  return output
}

function zScoreSeries(values: Series, period: number): Series {
  const output: Series = Array(values.length).fill(null)
  for (let index = period - 1; index < values.length; index += 1) {
    let count = 0
    let sum = 0
    let sumSquares = 0

    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      const value = values[cursor]
      if (!isFiniteNumber(value)) continue
      count += 1
      sum += value
      sumSquares += value * value
    }

    if (count < Math.max(8, Math.floor(period * 0.7))) continue
    const current = values[index]
    if (!isFiniteNumber(current)) continue
    const mean = sum / count
    const variance = Math.max(0, (sumSquares / count) - (mean * mean))
    const std = Math.sqrt(variance)
    if (std <= 0) continue
    output[index] = (current - mean) / std
  }
  return output
}

function ratioSeries(numerator: Series, denominator: number[], multiplier = 1): Series {
  const length = Math.min(numerator.length, denominator.length)
  const output: Series = Array(length).fill(null)
  for (let index = 0; index < length; index += 1) {
    const num = numerator[index]
    const den = denominator[index]
    if (!isFiniteNumber(num) || !isFiniteNumber(den) || den === 0) continue
    output[index] = (num / den) * multiplier
  }
  return output
}

function ratioDiffSeries(a: Series, b: Series, multiplier = 100): Series {
  const length = Math.min(a.length, b.length)
  const output: Series = Array(length).fill(null)
  for (let index = 0; index < length; index += 1) {
    const left = a[index]
    const right = b[index]
    if (!isFiniteNumber(left) || !isFiniteNumber(right) || right === 0) continue
    output[index] = ((left - right) / Math.abs(right)) * multiplier
  }
  return output
}

function pctChangeSeries(values: Series | number[], lag: number): Series {
  const output: Series = Array(values.length).fill(null)
  for (let index = lag; index < values.length; index += 1) {
    const current = values[index]
    const prior = values[index - lag]
    if (!isFiniteNumber(current) || !isFiniteNumber(prior) || prior === 0) continue
    output[index] = ((current - prior) / Math.abs(prior)) * 100
  }
  return output
}

function momentumPctSeries(values: number[], period: number): Series {
  return pctChangeSeries(values, period)
}

function rsiSeries(values: number[], period: number): Series {
  const output: Series = Array(values.length).fill(null)
  if (values.length <= period) return output

  let gainSum = 0
  let lossSum = 0
  for (let index = 1; index <= period; index += 1) {
    const delta = (values[index] ?? 0) - (values[index - 1] ?? 0)
    if (delta >= 0) gainSum += delta
    else lossSum += Math.abs(delta)
  }

  let avgGain = gainSum / period
  let avgLoss = lossSum / period
  output[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)))

  for (let index = period + 1; index < values.length; index += 1) {
    const delta = (values[index] ?? 0) - (values[index - 1] ?? 0)
    const gain = delta > 0 ? delta : 0
    const loss = delta < 0 ? Math.abs(delta) : 0
    avgGain = ((avgGain * (period - 1)) + gain) / period
    avgLoss = ((avgLoss * (period - 1)) + loss) / period
    output[index] = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)))
  }
  return output
}

function stochasticSeries(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number,
  smoothD: number,
): { k: Series; d: Series } {
  const k: Series = Array(closes.length).fill(null)
  for (let index = period - 1; index < closes.length; index += 1) {
    let highest = -Infinity
    let lowest = Infinity
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      highest = Math.max(highest, highs[cursor] ?? -Infinity)
      lowest = Math.min(lowest, lows[cursor] ?? Infinity)
    }
    const range = highest - lowest
    if (range <= 0 || !isFiniteNumber(range)) continue
    k[index] = ((closes[index] ?? 0) - lowest) / range * 100
  }
  return { k, d: smaSeries(k.map((value) => value ?? 0), smoothD).map((value, index) => (k[index] === null ? null : value)) }
}

function macdSeries(values: number[], fast: number, slow: number, signal: number): {
  line: Series
  signal: Series
  histogram: Series
} {
  const fastEma = emaSeries(values, fast)
  const slowEma = emaSeries(values, slow)
  const line: Series = Array(values.length).fill(null)
  for (let index = 0; index < values.length; index += 1) {
    const left = fastEma[index]
    const right = slowEma[index]
    if (!isFiniteNumber(left) || !isFiniteNumber(right)) continue
    line[index] = left - right
  }
  const signalLine = emaSeries(line.map((value) => value ?? 0), signal).map((value, index) => (line[index] === null ? null : value))
  const histogram: Series = Array(values.length).fill(null)
  for (let index = 0; index < values.length; index += 1) {
    const value = line[index]
    const s = signalLine[index]
    if (!isFiniteNumber(value) || !isFiniteNumber(s)) continue
    histogram[index] = value - s
  }
  return { line, signal: signalLine, histogram }
}

function atrSeries(candles: Candle[], period: number): Series {
  const output: Series = Array(candles.length).fill(null)
  const tr: number[] = []
  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index]
    if (!candle) {
      tr.push(0)
      continue
    }
    if (index === 0) {
      tr.push(candle.high - candle.low)
      continue
    }
    const prevClose = candles[index - 1]?.close ?? candle.close
    const range1 = candle.high - candle.low
    const range2 = Math.abs(candle.high - prevClose)
    const range3 = Math.abs(candle.low - prevClose)
    tr.push(Math.max(range1, range2, range3))
  }

  let atr = 0
  for (let index = 0; index < tr.length; index += 1) {
    if (index < period) {
      atr += tr[index] ?? 0
      if (index === period - 1) {
        atr /= period
        output[index] = atr
      }
      continue
    }
    atr = ((atr * (period - 1)) + (tr[index] ?? 0)) / period
    output[index] = atr
  }
  return output
}

function bollingerSeries(values: number[], period: number, deviation: number): {
  percentB: Series
  widthPct: Series
} {
  const middle = smaSeries(values, period)
  const std = rollingStdSeries(values, period)
  const percentB: Series = Array(values.length).fill(null)
  const widthPct: Series = Array(values.length).fill(null)

  for (let index = 0; index < values.length; index += 1) {
    const mid = middle[index]
    const stdev = std[index]
    const close = values[index]
    if (!isFiniteNumber(mid) || !isFiniteNumber(stdev) || !isFiniteNumber(close)) continue
    const upper = mid + deviation * stdev
    const lower = mid - deviation * stdev
    const spread = upper - lower
    if (spread <= 0 || mid === 0) continue
    percentB[index] = (close - lower) / spread
    widthPct[index] = (spread / Math.abs(mid)) * 100
  }
  return { percentB, widthPct }
}

function cciSeries(candles: Candle[], period: number): Series {
  const typical = candles.map((candle) => (candle.high + candle.low + candle.close) / 3)
  const smaTypical = smaSeries(typical, period)
  const output: Series = Array(candles.length).fill(null)

  for (let index = period - 1; index < candles.length; index += 1) {
    const currentTypical = typical[index]
    const mean = smaTypical[index]
    if (!isFiniteNumber(currentTypical) || !isFiniteNumber(mean)) continue

    let meanDeviation = 0
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      meanDeviation += Math.abs((typical[cursor] ?? currentTypical) - mean)
    }
    meanDeviation /= period
    if (meanDeviation === 0) continue
    output[index] = (currentTypical - mean) / (0.015 * meanDeviation)
  }
  return output
}

function williamsRSeries(highs: number[], lows: number[], closes: number[], period: number): Series {
  const output: Series = Array(closes.length).fill(null)
  for (let index = period - 1; index < closes.length; index += 1) {
    let highest = -Infinity
    let lowest = Infinity
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      highest = Math.max(highest, highs[cursor] ?? -Infinity)
      lowest = Math.min(lowest, lows[cursor] ?? Infinity)
    }
    const spread = highest - lowest
    if (spread <= 0 || !isFiniteNumber(spread)) continue
    output[index] = ((highest - (closes[index] ?? highest)) / spread) * -100
  }
  return output
}

function donchianPositionSeries(highs: number[], lows: number[], closes: number[], period: number): Series {
  const output: Series = Array(closes.length).fill(null)
  for (let index = period - 1; index < closes.length; index += 1) {
    let highest = -Infinity
    let lowest = Infinity
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      highest = Math.max(highest, highs[cursor] ?? -Infinity)
      lowest = Math.min(lowest, lows[cursor] ?? Infinity)
    }
    const spread = highest - lowest
    if (spread <= 0 || !isFiniteNumber(spread)) continue
    output[index] = ((closes[index] ?? lowest) - lowest) / spread
  }
  return output
}

function keltnerPositionSeries(closes: number[], ema: Series, atr: Series): Series {
  const output: Series = Array(closes.length).fill(null)
  for (let index = 0; index < closes.length; index += 1) {
    const e = ema[index]
    const a = atr[index]
    const close = closes[index]
    if (!isFiniteNumber(e) || !isFiniteNumber(a) || !isFiniteNumber(close) || a === 0) continue
    output[index] = (close - e) / a
  }
  return output
}

function vwapDeviationSeries(opens: number[], highs: number[], lows: number[], closes: number[], volumes: number[]): Series {
  const output: Series = Array(closes.length).fill(null)
  let cumulativePV = 0
  let cumulativeVolume = 0
  for (let index = 0; index < closes.length; index += 1) {
    const typicalPrice = ((opens[index] ?? 0) + (highs[index] ?? 0) + (lows[index] ?? 0) + (closes[index] ?? 0)) / 4
    const volume = volumes[index] ?? 0
    cumulativePV += typicalPrice * volume
    cumulativeVolume += volume
    if (cumulativeVolume <= 0) continue
    const vwap = cumulativePV / cumulativeVolume
    const close = closes[index]
    if (!isFiniteNumber(close) || !isFiniteNumber(vwap) || vwap === 0) continue
    output[index] = ((close - vwap) / Math.abs(vwap)) * 100
  }
  return output
}

function realizedVolSeries(closes: number[], period: number, intervalHours: number): Series {
  const output: Series = Array(closes.length).fill(null)
  const logReturns: number[] = Array(closes.length).fill(0)
  for (let index = 1; index < closes.length; index += 1) {
    const prev = closes[index - 1]
    const current = closes[index]
    if (!isFiniteNumber(prev) || !isFiniteNumber(current) || prev <= 0 || current <= 0) continue
    logReturns[index] = Math.log(current / prev)
  }

  const periodsPerYear = (365 * 24) / intervalHours
  for (let index = period; index < closes.length; index += 1) {
    let sum = 0
    let sumSquares = 0
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      const value = logReturns[cursor] ?? 0
      sum += value
      sumSquares += value * value
    }
    const mean = sum / period
    const variance = Math.max(0, (sumSquares / period) - (mean * mean))
    output[index] = Math.sqrt(variance * periodsPerYear) * 100
  }
  return output
}

function highLowRangePctSeries(highs: number[], lows: number[], closes: number[], period: number): Series {
  const output: Series = Array(closes.length).fill(null)
  for (let index = period - 1; index < closes.length; index += 1) {
    let sum = 0
    let count = 0
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      const high = highs[cursor]
      const low = lows[cursor]
      const close = closes[cursor]
      if (!isFiniteNumber(high) || !isFiniteNumber(low) || !isFiniteNumber(close) || close === 0) continue
      sum += ((high - low) / Math.abs(close)) * 100
      count += 1
    }
    if (count > 0) {
      output[index] = sum / count
    }
  }
  return output
}

function obvSeries(candles: Candle[]): number[] {
  const output: number[] = Array(candles.length).fill(0)
  let obv = 0
  for (let index = 1; index < candles.length; index += 1) {
    const prev = candles[index - 1]
    const current = candles[index]
    if (!prev || !current) continue
    if (current.close > prev.close) obv += current.volume
    else if (current.close < prev.close) obv -= current.volume
    output[index] = obv
  }
  return output
}

function cmfSeries(candles: Candle[], period: number): Series {
  const output: Series = Array(candles.length).fill(null)
  for (let index = period - 1; index < candles.length; index += 1) {
    let flowSum = 0
    let volumeSum = 0
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      const candle = candles[cursor]
      if (!candle) continue
      const spread = candle.high - candle.low
      if (!isFiniteNumber(spread) || spread <= 0) continue
      const multiplier = ((candle.close - candle.low) - (candle.high - candle.close)) / spread
      flowSum += multiplier * candle.volume
      volumeSum += candle.volume
    }
    if (volumeSum > 0) {
      output[index] = flowSum / volumeSum
    }
  }
  return output
}

function mfiSeries(candles: Candle[], period: number): Series {
  const output: Series = Array(candles.length).fill(null)
  const typicalPrices = candles.map((candle) => (candle.high + candle.low + candle.close) / 3)
  const rawFlow = candles.map((candle, index) => (typicalPrices[index] ?? 0) * candle.volume)

  for (let index = period; index < candles.length; index += 1) {
    let positiveFlow = 0
    let negativeFlow = 0
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      const currentTypical = typicalPrices[cursor] ?? 0
      const previousTypical = typicalPrices[cursor - 1] ?? currentTypical
      if (currentTypical >= previousTypical) positiveFlow += rawFlow[cursor] ?? 0
      else negativeFlow += rawFlow[cursor] ?? 0
    }
    if (negativeFlow <= 0) {
      output[index] = 100
      continue
    }
    const ratio = positiveFlow / negativeFlow
    output[index] = 100 - (100 / (1 + ratio))
  }
  return output
}

function adxSeries(candles: Candle[], period: number): { adx: Series; plusDI: Series; minusDI: Series } {
  const length = candles.length
  const plusDM: number[] = Array(length).fill(0)
  const minusDM: number[] = Array(length).fill(0)
  const tr: number[] = Array(length).fill(0)

  for (let index = 1; index < length; index += 1) {
    const current = candles[index]
    const previous = candles[index - 1]
    if (!current || !previous) continue

    const upMove = current.high - previous.high
    const downMove = previous.low - current.low
    plusDM[index] = upMove > downMove && upMove > 0 ? upMove : 0
    minusDM[index] = downMove > upMove && downMove > 0 ? downMove : 0

    const range1 = current.high - current.low
    const range2 = Math.abs(current.high - previous.close)
    const range3 = Math.abs(current.low - previous.close)
    tr[index] = Math.max(range1, range2, range3)
  }

  const smoothedTR = wilderSmoothing(tr, period)
  const smoothedPlus = wilderSmoothing(plusDM, period)
  const smoothedMinus = wilderSmoothing(minusDM, period)

  const plusDI: Series = Array(length).fill(null)
  const minusDI: Series = Array(length).fill(null)
  const dx: number[] = Array(length).fill(0)

  for (let index = 0; index < length; index += 1) {
    const trValue = smoothedTR[index]
    const plus = smoothedPlus[index]
    const minus = smoothedMinus[index]
    if (!isFiniteNumber(trValue) || trValue <= 0 || !isFiniteNumber(plus) || !isFiniteNumber(minus)) continue
    const plusValue = (plus / trValue) * 100
    const minusValue = (minus / trValue) * 100
    plusDI[index] = plusValue
    minusDI[index] = minusValue
    const denom = plusValue + minusValue
    if (denom <= 0) continue
    dx[index] = Math.abs(plusValue - minusValue) / denom * 100
  }

  const adxRaw = wilderSmoothing(dx, period)
  const adx: Series = adxRaw.map((value, index) => (index >= period * 2 - 1 && isFiniteNumber(value) ? value : null))
  return { adx, plusDI, minusDI }
}

function wilderSmoothing(values: number[], period: number): Series {
  const output: Series = Array(values.length).fill(null)
  if (values.length === 0) return output

  let seedSum = 0
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index] ?? 0
    if (index < period) {
      seedSum += value
      if (index === period - 1) {
        output[index] = seedSum
      }
      continue
    }
    const previous = output[index - 1]
    if (!isFiniteNumber(previous)) continue
    output[index] = previous - (previous / period) + value
  }
  return output
}

function computeFrequency(values: Series, thresholds: QuantileThresholds, classify: (value: number) => IndicatorState) {
  const stateCounts: Record<IndicatorState, number> = { high: 0, low: 0, neutral: 0 }
  const quantileCounts: Record<QuantileBucket, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, Q5: 0 }

  let transitions = 0
  let samples = 0
  let activeSamples = 0
  let previousState: IndicatorState | null = null

  for (const value of values) {
    if (!isFiniteNumber(value)) continue
    const state = classify(value)
    stateCounts[state] += 1
    if (state !== 'neutral') activeSamples += 1
    samples += 1

    const bucket = toQuantileBucket(value, thresholds)
    quantileCounts[bucket] += 1

    if (previousState !== null && previousState !== state) {
      transitions += 1
    }
    previousState = state
  }

  return {
    stateCounts,
    stateTransitions: transitions,
    stateTransitionRate: samples > 1 ? transitions / (samples - 1) : 0,
    activeRate: samples > 0 ? activeSamples / samples : 0,
    quantileCounts,
  }
}

interface QuantileThresholds {
  q20: number
  q40: number
  q60: number
  q80: number
}

function computeQuantileStats(values: number[], currentValue: number | null): {
  thresholds: QuantileThresholds
  currentRank: number | null
  currentBucket: QuantileBucket | null
} {
  if (values.length === 0) {
    return {
      thresholds: { q20: 0, q40: 0, q60: 0, q80: 0 },
      currentRank: null,
      currentBucket: null,
    }
  }

  const sorted = [...values].sort((left, right) => left - right)
  const thresholds = {
    q20: percentile(sorted, 0.2),
    q40: percentile(sorted, 0.4),
    q60: percentile(sorted, 0.6),
    q80: percentile(sorted, 0.8),
  }

  if (!isFiniteNumber(currentValue)) {
    return {
      thresholds,
      currentRank: null,
      currentBucket: null,
    }
  }

  const rank = quantileRank(sorted, currentValue)
  return {
    thresholds,
    currentRank: rank,
    currentBucket: toQuantileBucket(currentValue, thresholds),
  }
}

function percentile(sortedValues: number[], rank: number): number {
  if (sortedValues.length === 0) return 0
  const scaled = (sortedValues.length - 1) * rank
  const lowIndex = Math.floor(scaled)
  const highIndex = Math.min(sortedValues.length - 1, Math.ceil(scaled))
  const low = sortedValues[lowIndex] ?? sortedValues[0] ?? 0
  const high = sortedValues[highIndex] ?? low
  if (lowIndex === highIndex) return low
  const weight = scaled - lowIndex
  return low + (high - low) * weight
}

function quantileRank(sortedValues: number[], value: number): number {
  if (sortedValues.length === 0) return 0
  let lowerOrEqual = 0
  for (const current of sortedValues) {
    if (current <= value) lowerOrEqual += 1
    else break
  }
  return lowerOrEqual / sortedValues.length
}

function toQuantileBucket(value: number, thresholds: QuantileThresholds): QuantileBucket {
  if (value <= thresholds.q20) return 'Q1'
  if (value <= thresholds.q40) return 'Q2'
  if (value <= thresholds.q60) return 'Q3'
  if (value <= thresholds.q80) return 'Q4'
  return 'Q5'
}

function buildHitTimeline(
  hydratedMetrics: HydratedMetric[],
  candles: Candle[],
  interval: Interval,
  maxHitsPerCandle: number,
): CandleHitCluster[] {
  const durationMsPerBar = intervalToMs(interval)
  const metricsWithScale = hydratedMetrics.map((entry) => ({
    entry,
    scale: computeSeriesScale(entry.metric.rawValues ?? []),
  }))

  const timeline: CandleHitCluster[] = candles.map((candle, index) => {
    const ordered: IndicatorHitEvent[] = []
    const laneCounts: Partial<Record<IndicatorCategory, number>> = {}

    for (const { entry, scale } of metricsWithScale) {
      const stateSeries = entry.stateSeries
      const toState = stateSeries[index]
      if (!toState || toState === 'neutral') continue

      const fromState = index > 0 ? stateSeries[index - 1] ?? 'neutral' : 'neutral'
      const kind = activeStateKind(fromState, toState)
      const rawValues = entry.metric.rawValues ?? []
      const current = rawValues[index]
      const previous = index > 0 ? rawValues[index - 1] : current
      const durationBars = activeStateDurationBars(stateSeries, index, toState)
      const magnitude = computeTransitionMagnitude(current, previous, scale)

      ordered.push({
        id: `${entry.metric.id}:${candle.time}:${toState}`,
        time: candle.time,
        indicatorId: entry.metric.id,
        indicatorLabel: entry.metric.label,
        category: entry.metric.category,
        kind,
        fromState,
        toState,
        durationBars,
        durationMs: durationBars * durationMsPerBar,
        priority: eventPriority(kind, magnitude) + Math.min(0.4, Math.max(0, durationBars - 1) * 0.08),
        message: buildEventMessage(entry.metric.label, fromState, toState, durationBars),
      })
      laneCounts[entry.metric.category] = (laneCounts[entry.metric.category] ?? 0) + 1
    }

    ordered.sort((left, right) => right.priority - left.priority)
    const topHits = ordered.slice(0, maxHitsPerCandle)
    const base = candle.open === 0 ? Math.abs(candle.close) || 1 : Math.abs(candle.open)
    const changePct = ((candle.close - candle.open) / base) * 100
    const rangePct = ((candle.high - candle.low) / base) * 100
    return {
      time: candle.time,
      price: {
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        changePct,
        rangePct,
      },
      totalHits: ordered.length,
      events: ordered,
      topHits,
      overflowCount: Math.max(0, ordered.length - topHits.length),
      laneCounts,
    }
  })

  return timeline
}

function activeStateDurationBars(
  stateSeries: Array<IndicatorState | null>,
  index: number,
  state: Extract<IndicatorState, 'high' | 'low'>,
): number {
  let cursor = index
  while (cursor > 0 && stateSeries[cursor - 1] === state) {
    cursor -= 1
  }
  return Math.max(1, index - cursor + 1)
}

function activeStateKind(
  fromState: IndicatorState,
  toState: Extract<IndicatorState, 'high' | 'low'>,
): IndicatorHitEvent['kind'] {
  if (fromState === 'high' && toState === 'low') return 'flip'
  if (fromState === 'low' && toState === 'high') return 'flip'
  return toState === 'high' ? 'enter_high' : 'enter_low'
}

function computeSeriesScale(values: Series): number {
  const finite = values.filter((value): value is number => isFiniteNumber(value))
  if (finite.length < 2) return 1

  let sum = 0
  for (const value of finite) sum += value
  const mean = sum / finite.length

  let sumSquares = 0
  for (const value of finite) {
    const delta = value - mean
    sumSquares += delta * delta
  }
  const variance = sumSquares / finite.length
  const std = Math.sqrt(Math.max(variance, 0))
  return std > 1e-9 ? std : Math.max(Math.abs(mean), 1)
}

function computeTransitionMagnitude(
  current: number | null | undefined,
  previous: number | null | undefined,
  scale: number,
): number {
  if (!isFiniteNumber(current) || !isFiniteNumber(previous)) return 0.25
  const normalizedScale = Math.max(scale, 1e-9)
  const delta = Math.abs(current - previous) / normalizedScale
  const level = Math.abs(current) / normalizedScale
  return Math.min(3, delta * 0.8 + level * 0.2)
}

function eventPriority(kind: IndicatorHitEvent['kind'], magnitude: number): number {
  const base = kind === 'flip' ? 1.2 : kind === 'enter_high' || kind === 'enter_low' ? 0.9 : 0.6
  return base + Math.min(Math.max(magnitude, 0), 3)
}

function buildEventMessage(
  label: string,
  fromState: IndicatorState,
  toState: Extract<IndicatorState, 'high' | 'low'>,
  durationBars: number,
): string {
  if (fromState === toState) return `${label} stayed ${toState} for ${durationBars} bars.`
  if (fromState === 'neutral') return `${label} turned ${toState}.`
  return `${label} flipped from ${fromState} to ${toState}.`
}

function pairSeries(a: Series, b: Series, minSamples: number): { x: number[]; y: number[] } | null {
  const length = Math.min(a.length, b.length)
  const x: number[] = []
  const y: number[] = []
  for (let index = 0; index < length; index += 1) {
    const left = a[index]
    const right = b[index]
    if (!isFiniteNumber(left) || !isFiniteNumber(right)) continue
    x.push(left)
    y.push(right)
  }
  if (x.length < minSamples) return null
  return { x, y }
}

function bestLagCorrelation(a: Series, b: Series, maxLag: number, minSamples: number): { bars: number; correlation: number } {
  let bestBars = 0
  let bestCorrelation = 0

  for (let lag = -maxLag; lag <= maxLag; lag += 1) {
    const paired = pairSeriesWithLag(a, b, lag, minSamples)
    if (!paired) continue
    const corr = pearsonCorrelation(paired.x, paired.y)
    if (Math.abs(corr) > Math.abs(bestCorrelation)) {
      bestCorrelation = corr
      bestBars = lag
    }
  }

  return { bars: bestBars, correlation: bestCorrelation }
}

function pairSeriesWithLag(a: Series, b: Series, lagBars: number, minSamples: number): { x: number[]; y: number[] } | null {
  const x: number[] = []
  const y: number[] = []
  const length = Math.min(a.length, b.length)

  for (let index = 0; index < length; index += 1) {
    const bIndex = index + lagBars
    if (bIndex < 0 || bIndex >= length) continue
    const left = a[index]
    const right = b[bIndex]
    if (!isFiniteNumber(left) || !isFiniteNumber(right)) continue
    x.push(left)
    y.push(right)
  }

  if (x.length < minSamples) return null
  return { x, y }
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 2) return 0
  let sumX = 0
  let sumY = 0
  let sumXX = 0
  let sumYY = 0
  let sumXY = 0

  for (let index = 0; index < n; index += 1) {
    const vx = x[index] ?? 0
    const vy = y[index] ?? 0
    sumX += vx
    sumY += vy
    sumXX += vx * vx
    sumYY += vy * vy
    sumXY += vx * vy
  }

  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY))
  if (denominator <= 0 || !isFiniteNumber(denominator)) return 0
  const result = numerator / denominator
  return isFiniteNumber(result) ? result : 0
}

function spearmanCorrelation(x: number[], y: number[]): number {
  const rankedX = rankValues(x)
  const rankedY = rankValues(y)
  return pearsonCorrelation(rankedX, rankedY)
}

function rankValues(values: number[]): number[] {
  const indexed = values.map((value, index) => ({ value, index }))
  indexed.sort((left, right) => left.value - right.value)

  const ranks: number[] = Array(values.length).fill(0)
  let cursor = 0
  while (cursor < indexed.length) {
    let next = cursor + 1
    while (next < indexed.length && indexed[next]?.value === indexed[cursor]?.value) {
      next += 1
    }
    const averageRank = (cursor + next - 1) / 2 + 1
    for (let index = cursor; index < next; index += 1) {
      const originalIndex = indexed[index]?.index
      if (typeof originalIndex === 'number') {
        ranks[originalIndex] = averageRank
      }
    }
    cursor = next
  }
  return ranks
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

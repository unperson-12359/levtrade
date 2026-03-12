// src/types/market.ts
var TRACKED_COINS = ["BTC", "ETH", "SOL", "HYPE"];
function parseCandle(raw) {
  return {
    time: raw.t,
    open: parseFloat(raw.o),
    high: parseFloat(raw.h),
    low: parseFloat(raw.l),
    close: parseFloat(raw.c),
    volume: parseFloat(raw.v),
    trades: raw.n
  };
}

// src/observatory/engine.ts
var BOUNDED_RANGES = {
  momentum_rsi14: { min: 0, max: 100 },
  momentum_stoch_k14: { min: 0, max: 100 },
  momentum_stoch_d14: { min: 0, max: 100 },
  momentum_williams_r14: { min: -100, max: 0 },
  volume_mfi14: { min: 0, max: 100 },
  structure_donchian_pos_20: { min: 0, max: 1 },
  volatility_bb_percent_b: { min: -0.5, max: 1.5, tolerance: 0.05 }
};
function buildObservatorySnapshot(input) {
  const candles = input.candles;
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
        status: "healthy",
        total: 0,
        valid: 0,
        warnings: []
      }
    };
  }
  const times = candles.map((candle) => candle.time);
  const opens = candles.map((candle) => candle.open);
  const highs = candles.map((candle) => candle.high);
  const lows = candles.map((candle) => candle.low);
  const closes = candles.map((candle) => candle.close);
  const volumes = candles.map((candle) => candle.volume);
  const trades = candles.map((candle) => candle.trades);
  const intervalHours = intervalToHours(input.interval);
  const sma20 = smaSeries(closes, 20);
  const sma50 = smaSeries(closes, 50);
  const ema8 = emaSeries(closes, 8);
  const ema21 = emaSeries(closes, 21);
  const rsi14 = rsiSeries(closes, 14);
  const stoch = stochasticSeries(highs, lows, closes, 14, 3);
  const macd = macdSeries(closes, 12, 26, 9);
  const atr14 = atrSeries(candles, 14);
  const roc10 = pctChangeSeries(closes, 10);
  const roc24 = pctChangeSeries(closes, 24);
  const momentum10 = momentumPctSeries(closes, 10);
  const cci20 = cciSeries(candles, 20);
  const williamsR14 = williamsRSeries(highs, lows, closes, 14);
  const mfi14 = mfiSeries(candles, 14);
  const bb = bollingerSeries(closes, 20, 2);
  const donchianPos20 = donchianPositionSeries(highs, lows, closes, 20);
  const keltnerPos20 = keltnerPositionSeries(closes, ema21, atr14);
  const vwapDeviation = vwapDeviationSeries(opens, highs, lows, closes, volumes);
  const volumeZ20 = zScoreSeries(wrapNumericSeries(volumes), 20);
  const tradesZ20 = zScoreSeries(wrapNumericSeries(trades), 20);
  const priceChange1Bar = pctChangeSeries(closes, 1);
  const priceChange24h = pctChangeSeries(closes, Math.max(1, Math.round(24 / intervalHours)));
  const ema8_21Cross = crossoverSeries(ema8, ema21);
  const sma20_50Cross = crossoverSeries(sma20, sma50);
  const zeroLine = closes.map(() => 0);
  const macdZeroCross = crossoverSeries(macd.line, zeroLine);
  const stochKDCross = crossoverSeries(stoch.k, stoch.d);
  const bbSqueeze = squeezeSeries(bb.widthPct, 4);
  const bodyAnomaly = bodyRatioZSeries(candles, 20);
  const volumeSpikeZ = zScoreSeries(wrapNumericSeries(volumes), 20);
  const donchianBreak = donchianBreakSeries(donchianPos20);
  const seeds = [
    makeMetric(
      "trend_ema_8_21_spread",
      "EMA 8/21 Spread",
      "Trend",
      "%",
      "Fast trend acceleration against the core EMA baseline.",
      ratioDiffSeries(ema8, ema21, 100),
      signedState(0.35)
    ),
    makeMetric(
      "event_ema_8_21_cross",
      "EMA 8/21 Cross",
      "Trend",
      "",
      "Fires when the fast EMA crosses the slow EMA \u2014 a trend direction change.",
      ema8_21Cross,
      signedState(0.5)
    ),
    makeMetric(
      "event_sma_20_50_cross",
      "SMA 20/50 Cross",
      "Trend",
      "",
      "Golden/death cross \u2014 medium-term trend reversal signal.",
      sma20_50Cross,
      signedState(0.5)
    ),
    makeMetric(
      "structure_donchian_pos_20",
      "Donchian Position 20",
      "Structure",
      "0-1",
      "Position of price between 20-bar range low and high.",
      donchianPos20,
      bandState(0.2, 0.8)
    ),
    makeMetric(
      "structure_keltner_pos_20",
      "Keltner Position",
      "Structure",
      "xATR",
      "Price distance from EMA21 expressed in ATR units.",
      keltnerPos20,
      signedState(0.8)
    ),
    makeMetric(
      "structure_vwap_dev",
      "VWAP Deviation",
      "Structure",
      "%",
      "Distance of close from cumulative VWAP.",
      vwapDeviation,
      signedState(0.6)
    ),
    makeMetric(
      "momentum_rsi14",
      "RSI 14",
      "Momentum",
      "",
      "Relative strength momentum oscillator.",
      rsi14,
      bandState(30, 70)
    ),
    makeMetric(
      "momentum_stoch_k14",
      "Stochastic K 14",
      "Momentum",
      "",
      "Close position in rolling 14-bar high-low range.",
      stoch.k,
      bandState(20, 80)
    ),
    makeMetric(
      "momentum_stoch_d14",
      "Stochastic D 14",
      "Momentum",
      "",
      "Smoothed stochastic momentum signal line.",
      stoch.d,
      bandState(20, 80)
    ),
    makeMetric(
      "momentum_macd_hist_pct",
      "MACD Histogram",
      "Momentum",
      "%",
      "Momentum spread between MACD line and signal line.",
      ratioSeries(macd.histogram, closes, 100),
      signedState(0.08)
    ),
    makeMetric(
      "event_macd_zero_cross",
      "MACD Zero Cross",
      "Momentum",
      "",
      "Fires when MACD line crosses zero \u2014 momentum direction change.",
      macdZeroCross,
      signedState(0.5)
    ),
    makeMetric(
      "event_stoch_kd_cross",
      "Stoch K/D Cross",
      "Momentum",
      "",
      "Fires when Stochastic K crosses D \u2014 short-term momentum flip.",
      stochKDCross,
      signedState(0.5)
    ),
    makeMetric(
      "momentum_roc_10",
      "ROC 10",
      "Momentum",
      "%",
      "10-bar percentage rate of change.",
      roc10,
      signedState(1)
    ),
    makeMetric(
      "momentum_roc_24",
      "ROC 24 Bars",
      "Momentum",
      "%",
      "24-bar percentage rate of change.",
      roc24,
      signedState(1.4)
    ),
    makeMetric(
      "momentum_mom_10",
      "Momentum 10",
      "Momentum",
      "%",
      "10-bar momentum amplitude.",
      momentum10,
      signedState(1)
    ),
    makeMetric(
      "momentum_williams_r14",
      "Williams %R 14",
      "Momentum",
      "",
      "Momentum oscillator normalized between -100 and 0.",
      williamsR14,
      bandState(-80, -20)
    ),
    makeMetric(
      "momentum_cci20",
      "CCI 20",
      "Momentum",
      "",
      "Commodity channel momentum against its mean deviation.",
      cci20,
      signedState(100)
    ),
    makeMetric(
      "volatility_bb_percent_b",
      "Bollinger %B",
      "Volatility",
      "",
      "Relative location inside Bollinger envelope.",
      bb.percentB,
      bandState(0.15, 0.85)
    ),
    makeMetric(
      "event_bb_squeeze",
      "BB Squeeze Breakout",
      "Volatility",
      "",
      "Fires when Bollinger Bands expand after a compression \u2014 volatility regime change.",
      bbSqueeze,
      bandState(0.5, 1.5)
    ),
    makeMetric(
      "volume_mfi14",
      "MFI 14",
      "Volume",
      "",
      "Volume-weighted momentum oscillator.",
      mfi14,
      bandState(30, 70)
    ),
    makeMetric(
      "volume_z20",
      "Volume Z 20",
      "Volume",
      "z",
      "Relative deviation of volume from 20-bar baseline.",
      volumeZ20,
      signedState(1)
    ),
    makeMetric(
      "volume_trades_z20",
      "Trades Z 20",
      "Volume",
      "z",
      "Relative deviation of trade count from 20-bar baseline.",
      tradesZ20,
      signedState(1)
    ),
    makeMetric(
      "momentum_price_change_1h",
      "Price Change 1 Bar",
      "Momentum",
      "%",
      "Single-bar return for local acceleration mapping.",
      priceChange1Bar,
      signedState(0.8)
    ),
    makeMetric(
      "momentum_price_change_24h",
      "Price Change 24h",
      "Momentum",
      "%",
      "24-hour equivalent return for regime drift mapping.",
      priceChange24h,
      signedState(2)
    ),
    makeMetric(
      "event_volume_spike",
      "Volume Spike",
      "Volume",
      "z",
      "Fires when volume exceeds 2 standard deviations above baseline \u2014 unusual activity.",
      volumeSpikeZ,
      signedState(2)
    ),
    makeMetric(
      "event_body_anomaly",
      "Candle Body Anomaly",
      "Structure",
      "z",
      "Fires when candle body is unusually large relative to recent bars.",
      bodyAnomaly,
      signedState(1.5)
    ),
    makeMetric(
      "event_donchian_break",
      "Donchian Breakout",
      "Structure",
      "0-1",
      "Fires when price touches the 20-bar high or low \u2014 range breakout.",
      donchianBreak,
      bandState(0.01, 0.99)
    )
  ];
  const hydrated = seeds.map((seed) => hydrateMetric(seed, times)).filter((entry) => entry.metric.series.length > 25);
  const indicators = hydrated.map((entry) => entry.metric);
  const edges = computeCorrelationEdges(indicators, 12);
  const timeline = buildHitTimeline(hydrated, candles, input.interval, 3);
  const barStates = buildIndicatorBarStates(hydrated, times);
  const health = computeIndicatorHealth(indicators);
  return {
    coin: input.coin,
    interval: input.interval,
    generatedAt: Date.now(),
    candleCount: candles.length,
    indicators,
    edges,
    timeline,
    barStates,
    health
  };
}
function buildIndicatorBarStates(hydratedMetrics, times) {
  return times.map((time, index) => {
    const laneCounts = {};
    const activeIndicatorIds = [];
    for (const entry of hydratedMetrics) {
      const state = entry.stateSeries[index];
      if (!state || state === "neutral") continue;
      activeIndicatorIds.push(entry.metric.id);
      laneCounts[entry.metric.category] = (laneCounts[entry.metric.category] ?? 0) + 1;
    }
    return {
      time,
      activeCount: activeIndicatorIds.length,
      laneCounts,
      activeIndicatorIds
    };
  });
}
function buildIndicatorStateRecords(snapshot) {
  const categories = new Map(snapshot.indicators.map((indicator) => [indicator.id, indicator.category]));
  return snapshot.barStates.flatMap((barState) => {
    const activeIndicators = new Set(barState.activeIndicatorIds);
    return snapshot.indicators.map((indicator) => ({
      id: `${snapshot.coin}:${snapshot.interval}:${barState.time}:${indicator.id}`,
      coin: snapshot.coin,
      interval: snapshot.interval,
      candleTime: barState.time,
      indicatorId: indicator.id,
      category: categories.get(indicator.id) ?? indicator.category,
      isOn: activeIndicators.has(indicator.id)
    }));
  });
}
function hydrateMetric(seed, times) {
  const series = [];
  const stateSeries = Array(seed.values.length).fill(null);
  for (let index = 0; index < seed.values.length; index += 1) {
    const value = seed.values[index];
    if (!isFiniteNumber(value)) continue;
    const time = times[index];
    if (typeof time !== "number") continue;
    stateSeries[index] = seed.classify(value);
    series.push({ time, value });
  }
  const currentValue = series.length > 0 ? series[series.length - 1].value : null;
  const currentState = currentValue === null ? "neutral" : seed.classify(currentValue);
  const quantiles = computeQuantileStats(series.map((point) => point.value), currentValue);
  const frequency = computeFrequency(seed.values, quantiles.thresholds, seed.classify);
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
      frequency
    },
    stateSeries
  };
}
function computeCorrelationEdges(indicators, maxLagBars) {
  const edges = [];
  for (let left = 0; left < indicators.length; left += 1) {
    const a = indicators[left];
    if (!a) continue;
    for (let right = left + 1; right < indicators.length; right += 1) {
      const b = indicators[right];
      if (!b) continue;
      const valuesA = a.rawValues ?? [];
      const valuesB = b.rawValues ?? [];
      const paired = pairSeries(valuesA, valuesB, 40);
      if (!paired) continue;
      const pearson = pearsonCorrelation(paired.x, paired.y);
      const spearman = spearmanCorrelation(paired.x, paired.y);
      const lag = bestLagCorrelation(valuesA, valuesB, maxLagBars, 40);
      const strength = (Math.abs(pearson) + Math.abs(spearman) + Math.abs(lag.correlation)) / 3;
      if (!isFiniteNumber(strength) || strength < 0.25) continue;
      edges.push({
        a: a.id,
        b: b.id,
        pearson,
        spearman,
        lagBars: lag.bars,
        lagCorrelation: lag.correlation,
        sampleSize: paired.x.length,
        strength
      });
    }
  }
  return edges.sort((x, y) => y.strength - x.strength).slice(0, 220);
}
function computeIndicatorHealth(indicators) {
  if (indicators.length === 0) {
    return {
      status: "healthy",
      total: 0,
      valid: 0,
      warnings: []
    };
  }
  const warnings = [];
  const warnedIndicators = /* @__PURE__ */ new Set();
  const seenWarnings = /* @__PURE__ */ new Set();
  const pushWarning = (indicator, kind, message) => {
    const key = `${indicator.id}:${kind}:${message}`;
    if (seenWarnings.has(key)) return;
    seenWarnings.add(key);
    warnedIndicators.add(indicator.id);
    warnings.push({
      indicatorId: indicator.id,
      indicatorLabel: indicator.label,
      kind,
      message
    });
  };
  for (const indicator of indicators) {
    const rawValues = indicator.rawValues ?? [];
    const finiteValues = rawValues.filter((value) => isFiniteNumber(value));
    const totalSamples = rawValues.length;
    const finiteSamples = finiteValues.length;
    if (finiteSamples < 30) {
      pushWarning(indicator, "insufficient_data", `Only ${finiteSamples} valid samples available.`);
    }
    if (totalSamples > 0) {
      const coverage = finiteSamples / totalSamples;
      if (coverage < 0.55) {
        pushWarning(indicator, "insufficient_data", `Coverage ${(coverage * 100).toFixed(0)}% below 55%.`);
      }
    }
    if (finiteValues.length >= 20) {
      const scale = computeSeriesScale(rawValues);
      if (scale < 1e-9) {
        pushWarning(indicator, "flatline", "Series is nearly flat and may not carry signal information.");
      }
    }
    const bounds = BOUNDED_RANGES[indicator.id];
    if (!bounds || finiteValues.length === 0) continue;
    const minValue = Math.min(...finiteValues);
    const maxValue = Math.max(...finiteValues);
    const tolerance = bounds.tolerance ?? 0;
    if (minValue < bounds.min - tolerance || maxValue > bounds.max + tolerance) {
      pushWarning(
        indicator,
        "range_violation",
        `Observed range ${minValue.toFixed(2)}..${maxValue.toFixed(2)} outside expected ${bounds.min}..${bounds.max}.`
      );
    }
  }
  const valid = Math.max(0, indicators.length - warnedIndicators.size);
  const validRatio = indicators.length > 0 ? valid / indicators.length : 1;
  const status = warnings.length === 0 ? "healthy" : validRatio >= 0.85 ? "warning" : "critical";
  return {
    status,
    total: indicators.length,
    valid,
    warnings: warnings.slice(0, 32)
  };
}
function makeMetric(id, label, category, unit, description, values, classify) {
  return {
    id,
    label,
    category,
    unit,
    description,
    values,
    classify
  };
}
function signedState(threshold) {
  return (value) => {
    if (value >= threshold) return "high";
    if (value <= -threshold) return "low";
    return "neutral";
  };
}
function bandState(low, high) {
  return (value) => {
    if (value >= high) return "high";
    if (value <= low) return "low";
    return "neutral";
  };
}
function intervalToHours(interval) {
  if (interval === "1h") return 1;
  if (interval === "4h") return 4;
  return 24;
}
function intervalToMs(interval) {
  if (interval === "1h") return 60 * 60 * 1e3;
  if (interval === "4h") return 4 * 60 * 60 * 1e3;
  return 24 * 60 * 60 * 1e3;
}
function wrapNumericSeries(values) {
  return values.map((value) => isFiniteNumber(value) ? value : null);
}
function smaSeries(values, period) {
  const output = Array(values.length).fill(null);
  if (period <= 1) return wrapNumericSeries(values);
  let rollingSum = 0;
  for (let index = 0; index < values.length; index += 1) {
    rollingSum += values[index] ?? 0;
    if (index >= period) {
      rollingSum -= values[index - period] ?? 0;
    }
    if (index >= period - 1) {
      output[index] = rollingSum / period;
    }
  }
  return output;
}
function emaSeries(values, period) {
  const output = Array(values.length).fill(null);
  if (values.length === 0) return output;
  const alpha = 2 / (period + 1);
  let prev = values[0] ?? 0;
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index] ?? prev;
    prev = index === 0 ? value : value * alpha + prev * (1 - alpha);
    if (index >= period - 1) {
      output[index] = prev;
    }
  }
  return output;
}
function rollingStdSeries(values, period) {
  const output = Array(values.length).fill(null);
  for (let index = period - 1; index < values.length; index += 1) {
    let sum = 0;
    let sumSquares = 0;
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      const value = values[cursor] ?? 0;
      sum += value;
      sumSquares += value * value;
    }
    const mean = sum / period;
    const variance = Math.max(0, sumSquares / period - mean * mean);
    output[index] = Math.sqrt(variance);
  }
  return output;
}
function zScoreSeries(values, period) {
  const output = Array(values.length).fill(null);
  for (let index = period - 1; index < values.length; index += 1) {
    let count = 0;
    let sum = 0;
    let sumSquares = 0;
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      const value = values[cursor];
      if (!isFiniteNumber(value)) continue;
      count += 1;
      sum += value;
      sumSquares += value * value;
    }
    if (count < Math.max(8, Math.floor(period * 0.7))) continue;
    const current = values[index];
    if (!isFiniteNumber(current)) continue;
    const mean = sum / count;
    const variance = Math.max(0, sumSquares / count - mean * mean);
    const std = Math.sqrt(variance);
    if (std <= 0) continue;
    output[index] = (current - mean) / std;
  }
  return output;
}
function ratioSeries(numerator, denominator, multiplier = 1) {
  const length = Math.min(numerator.length, denominator.length);
  const output = Array(length).fill(null);
  for (let index = 0; index < length; index += 1) {
    const num = numerator[index];
    const den = denominator[index];
    if (!isFiniteNumber(num) || !isFiniteNumber(den) || den === 0) continue;
    output[index] = num / den * multiplier;
  }
  return output;
}
function ratioDiffSeries(a, b, multiplier = 100) {
  const length = Math.min(a.length, b.length);
  const output = Array(length).fill(null);
  for (let index = 0; index < length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (!isFiniteNumber(left) || !isFiniteNumber(right) || right === 0) continue;
    output[index] = (left - right) / Math.abs(right) * multiplier;
  }
  return output;
}
function pctChangeSeries(values, lag) {
  const output = Array(values.length).fill(null);
  for (let index = lag; index < values.length; index += 1) {
    const current = values[index];
    const prior = values[index - lag];
    if (!isFiniteNumber(current) || !isFiniteNumber(prior) || prior === 0) continue;
    output[index] = (current - prior) / Math.abs(prior) * 100;
  }
  return output;
}
function momentumPctSeries(values, period) {
  return pctChangeSeries(values, period);
}
function rsiSeries(values, period) {
  const output = Array(values.length).fill(null);
  if (values.length <= period) return output;
  let gainSum = 0;
  let lossSum = 0;
  for (let index = 1; index <= period; index += 1) {
    const delta = (values[index] ?? 0) - (values[index - 1] ?? 0);
    if (delta >= 0) gainSum += delta;
    else lossSum += Math.abs(delta);
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  output[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let index = period + 1; index < values.length; index += 1) {
    const delta = (values[index] ?? 0) - (values[index - 1] ?? 0);
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? Math.abs(delta) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    output[index] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return output;
}
function stochasticSeries(highs, lows, closes, period, smoothD) {
  const k = Array(closes.length).fill(null);
  for (let index = period - 1; index < closes.length; index += 1) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      highest = Math.max(highest, highs[cursor] ?? -Infinity);
      lowest = Math.min(lowest, lows[cursor] ?? Infinity);
    }
    const range = highest - lowest;
    if (range <= 0 || !isFiniteNumber(range)) continue;
    k[index] = ((closes[index] ?? 0) - lowest) / range * 100;
  }
  return { k, d: smaSeries(k.map((value) => value ?? 0), smoothD).map((value, index) => k[index] === null ? null : value) };
}
function macdSeries(values, fast, slow, signal) {
  const fastEma = emaSeries(values, fast);
  const slowEma = emaSeries(values, slow);
  const line = Array(values.length).fill(null);
  for (let index = 0; index < values.length; index += 1) {
    const left = fastEma[index];
    const right = slowEma[index];
    if (!isFiniteNumber(left) || !isFiniteNumber(right)) continue;
    line[index] = left - right;
  }
  const signalLine = emaSeries(line.map((value) => value ?? 0), signal).map((value, index) => line[index] === null ? null : value);
  const histogram = Array(values.length).fill(null);
  for (let index = 0; index < values.length; index += 1) {
    const value = line[index];
    const s = signalLine[index];
    if (!isFiniteNumber(value) || !isFiniteNumber(s)) continue;
    histogram[index] = value - s;
  }
  return { line, signal: signalLine, histogram };
}
function atrSeries(candles, period) {
  const output = Array(candles.length).fill(null);
  const tr = [];
  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    if (!candle) {
      tr.push(0);
      continue;
    }
    if (index === 0) {
      tr.push(candle.high - candle.low);
      continue;
    }
    const prevClose = candles[index - 1]?.close ?? candle.close;
    const range1 = candle.high - candle.low;
    const range2 = Math.abs(candle.high - prevClose);
    const range3 = Math.abs(candle.low - prevClose);
    tr.push(Math.max(range1, range2, range3));
  }
  let atr = 0;
  for (let index = 0; index < tr.length; index += 1) {
    if (index < period) {
      atr += tr[index] ?? 0;
      if (index === period - 1) {
        atr /= period;
        output[index] = atr;
      }
      continue;
    }
    atr = (atr * (period - 1) + (tr[index] ?? 0)) / period;
    output[index] = atr;
  }
  return output;
}
function bollingerSeries(values, period, deviation) {
  const middle = smaSeries(values, period);
  const std = rollingStdSeries(values, period);
  const percentB = Array(values.length).fill(null);
  const widthPct = Array(values.length).fill(null);
  for (let index = 0; index < values.length; index += 1) {
    const mid = middle[index];
    const stdev = std[index];
    const close = values[index];
    if (!isFiniteNumber(mid) || !isFiniteNumber(stdev) || !isFiniteNumber(close)) continue;
    const upper = mid + deviation * stdev;
    const lower = mid - deviation * stdev;
    const spread = upper - lower;
    if (spread <= 0 || mid === 0) continue;
    percentB[index] = (close - lower) / spread;
    widthPct[index] = spread / Math.abs(mid) * 100;
  }
  return { percentB, widthPct };
}
function cciSeries(candles, period) {
  const typical = candles.map((candle) => (candle.high + candle.low + candle.close) / 3);
  const smaTypical = smaSeries(typical, period);
  const output = Array(candles.length).fill(null);
  for (let index = period - 1; index < candles.length; index += 1) {
    const currentTypical = typical[index];
    const mean = smaTypical[index];
    if (!isFiniteNumber(currentTypical) || !isFiniteNumber(mean)) continue;
    let meanDeviation = 0;
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      meanDeviation += Math.abs((typical[cursor] ?? currentTypical) - mean);
    }
    meanDeviation /= period;
    if (meanDeviation === 0) continue;
    output[index] = (currentTypical - mean) / (0.015 * meanDeviation);
  }
  return output;
}
function williamsRSeries(highs, lows, closes, period) {
  const output = Array(closes.length).fill(null);
  for (let index = period - 1; index < closes.length; index += 1) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      highest = Math.max(highest, highs[cursor] ?? -Infinity);
      lowest = Math.min(lowest, lows[cursor] ?? Infinity);
    }
    const spread = highest - lowest;
    if (spread <= 0 || !isFiniteNumber(spread)) continue;
    output[index] = (highest - (closes[index] ?? highest)) / spread * -100;
  }
  return output;
}
function donchianPositionSeries(highs, lows, closes, period) {
  const output = Array(closes.length).fill(null);
  for (let index = period - 1; index < closes.length; index += 1) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      highest = Math.max(highest, highs[cursor] ?? -Infinity);
      lowest = Math.min(lowest, lows[cursor] ?? Infinity);
    }
    const spread = highest - lowest;
    if (spread <= 0 || !isFiniteNumber(spread)) continue;
    output[index] = ((closes[index] ?? lowest) - lowest) / spread;
  }
  return output;
}
function keltnerPositionSeries(closes, ema, atr) {
  const output = Array(closes.length).fill(null);
  for (let index = 0; index < closes.length; index += 1) {
    const e = ema[index];
    const a = atr[index];
    const close = closes[index];
    if (!isFiniteNumber(e) || !isFiniteNumber(a) || !isFiniteNumber(close) || a === 0) continue;
    output[index] = (close - e) / a;
  }
  return output;
}
function vwapDeviationSeries(opens, highs, lows, closes, volumes) {
  const output = Array(closes.length).fill(null);
  let cumulativePV = 0;
  let cumulativeVolume = 0;
  for (let index = 0; index < closes.length; index += 1) {
    const typicalPrice = ((opens[index] ?? 0) + (highs[index] ?? 0) + (lows[index] ?? 0) + (closes[index] ?? 0)) / 4;
    const volume = volumes[index] ?? 0;
    cumulativePV += typicalPrice * volume;
    cumulativeVolume += volume;
    if (cumulativeVolume <= 0) continue;
    const vwap = cumulativePV / cumulativeVolume;
    const close = closes[index];
    if (!isFiniteNumber(close) || !isFiniteNumber(vwap) || vwap === 0) continue;
    output[index] = (close - vwap) / Math.abs(vwap) * 100;
  }
  return output;
}
function mfiSeries(candles, period) {
  const output = Array(candles.length).fill(null);
  const typicalPrices = candles.map((candle) => (candle.high + candle.low + candle.close) / 3);
  const rawFlow = candles.map((candle, index) => (typicalPrices[index] ?? 0) * candle.volume);
  for (let index = period; index < candles.length; index += 1) {
    let positiveFlow = 0;
    let negativeFlow = 0;
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      const currentTypical = typicalPrices[cursor] ?? 0;
      const previousTypical = typicalPrices[cursor - 1] ?? currentTypical;
      if (currentTypical >= previousTypical) positiveFlow += rawFlow[cursor] ?? 0;
      else negativeFlow += rawFlow[cursor] ?? 0;
    }
    if (negativeFlow <= 0) {
      output[index] = 100;
      continue;
    }
    const ratio = positiveFlow / negativeFlow;
    output[index] = 100 - 100 / (1 + ratio);
  }
  return output;
}
function computeFrequency(values, thresholds, classify) {
  const stateCounts = { high: 0, low: 0, neutral: 0 };
  const quantileCounts = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, Q5: 0 };
  let transitions = 0;
  let samples = 0;
  let activeSamples = 0;
  let previousState = null;
  for (const value of values) {
    if (!isFiniteNumber(value)) continue;
    const state = classify(value);
    stateCounts[state] += 1;
    if (state !== "neutral") activeSamples += 1;
    samples += 1;
    const bucket = toQuantileBucket(value, thresholds);
    quantileCounts[bucket] += 1;
    if (previousState !== null && previousState !== state) {
      transitions += 1;
    }
    previousState = state;
  }
  return {
    stateCounts,
    stateTransitions: transitions,
    stateTransitionRate: samples > 1 ? transitions / (samples - 1) : 0,
    activeRate: samples > 0 ? activeSamples / samples : 0,
    quantileCounts
  };
}
function computeQuantileStats(values, currentValue) {
  if (values.length === 0) {
    return {
      thresholds: { q20: 0, q40: 0, q60: 0, q80: 0 },
      currentRank: null,
      currentBucket: null
    };
  }
  const sorted = [...values].sort((left, right) => left - right);
  const thresholds = {
    q20: percentile(sorted, 0.2),
    q40: percentile(sorted, 0.4),
    q60: percentile(sorted, 0.6),
    q80: percentile(sorted, 0.8)
  };
  if (!isFiniteNumber(currentValue)) {
    return {
      thresholds,
      currentRank: null,
      currentBucket: null
    };
  }
  const rank = quantileRank(sorted, currentValue);
  return {
    thresholds,
    currentRank: rank,
    currentBucket: toQuantileBucket(currentValue, thresholds)
  };
}
function percentile(sortedValues, rank) {
  if (sortedValues.length === 0) return 0;
  const scaled = (sortedValues.length - 1) * rank;
  const lowIndex = Math.floor(scaled);
  const highIndex = Math.min(sortedValues.length - 1, Math.ceil(scaled));
  const low = sortedValues[lowIndex] ?? sortedValues[0] ?? 0;
  const high = sortedValues[highIndex] ?? low;
  if (lowIndex === highIndex) return low;
  const weight = scaled - lowIndex;
  return low + (high - low) * weight;
}
function quantileRank(sortedValues, value) {
  if (sortedValues.length === 0) return 0;
  let lowerOrEqual = 0;
  for (const current of sortedValues) {
    if (current <= value) lowerOrEqual += 1;
    else break;
  }
  return lowerOrEqual / sortedValues.length;
}
function toQuantileBucket(value, thresholds) {
  if (value <= thresholds.q20) return "Q1";
  if (value <= thresholds.q40) return "Q2";
  if (value <= thresholds.q60) return "Q3";
  if (value <= thresholds.q80) return "Q4";
  return "Q5";
}
function buildHitTimeline(hydratedMetrics, candles, interval, maxHitsPerCandle) {
  const durationMsPerBar = intervalToMs(interval);
  const metricsWithScale = hydratedMetrics.map((entry) => ({
    entry,
    scale: computeSeriesScale(entry.metric.rawValues ?? [])
  }));
  const timeline = candles.map((candle, index) => {
    const ordered = [];
    const laneCounts = {};
    for (const { entry, scale } of metricsWithScale) {
      const stateSeries = entry.stateSeries;
      const toState = stateSeries[index];
      if (!toState || toState === "neutral") continue;
      const fromState = index > 0 ? stateSeries[index - 1] ?? "neutral" : "neutral";
      const kind = activeStateKind(fromState, toState);
      const rawValues = entry.metric.rawValues ?? [];
      const current = rawValues[index];
      const previous = index > 0 ? rawValues[index - 1] : current;
      const durationBars = activeStateDurationBars(stateSeries, index, toState);
      const magnitude = computeTransitionMagnitude(current, previous, scale);
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
        message: buildEventMessage(entry.metric.label, fromState, toState, durationBars)
      });
      laneCounts[entry.metric.category] = (laneCounts[entry.metric.category] ?? 0) + 1;
    }
    ordered.sort((left, right) => right.priority - left.priority);
    const topHits = ordered.slice(0, maxHitsPerCandle);
    const base = candle.open === 0 ? Math.abs(candle.close) || 1 : Math.abs(candle.open);
    const changePct = (candle.close - candle.open) / base * 100;
    const rangePct = (candle.high - candle.low) / base * 100;
    return {
      time: candle.time,
      price: {
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        changePct,
        rangePct
      },
      totalHits: ordered.length,
      events: ordered,
      topHits,
      overflowCount: Math.max(0, ordered.length - topHits.length),
      laneCounts
    };
  });
  return timeline;
}
function activeStateDurationBars(stateSeries, index, state) {
  let cursor = index;
  while (cursor > 0 && stateSeries[cursor - 1] === state) {
    cursor -= 1;
  }
  return Math.max(1, index - cursor + 1);
}
function activeStateKind(fromState, toState) {
  if (fromState === "high" && toState === "low") return "flip";
  if (fromState === "low" && toState === "high") return "flip";
  return toState === "high" ? "enter_high" : "enter_low";
}
function computeSeriesScale(values) {
  const finite = values.filter((value) => isFiniteNumber(value));
  if (finite.length < 2) return 1;
  let sum = 0;
  for (const value of finite) sum += value;
  const mean = sum / finite.length;
  let sumSquares = 0;
  for (const value of finite) {
    const delta = value - mean;
    sumSquares += delta * delta;
  }
  const variance = sumSquares / finite.length;
  const std = Math.sqrt(Math.max(variance, 0));
  return std > 1e-9 ? std : Math.max(Math.abs(mean), 1);
}
function computeTransitionMagnitude(current, previous, scale) {
  if (!isFiniteNumber(current) || !isFiniteNumber(previous)) return 0.25;
  const normalizedScale = Math.max(scale, 1e-9);
  const delta = Math.abs(current - previous) / normalizedScale;
  const level = Math.abs(current) / normalizedScale;
  return Math.min(3, delta * 0.8 + level * 0.2);
}
function eventPriority(kind, magnitude) {
  const base = kind === "flip" ? 1.2 : kind === "enter_high" || kind === "enter_low" ? 0.9 : 0.6;
  return base + Math.min(Math.max(magnitude, 0), 3);
}
function buildEventMessage(label, fromState, toState, durationBars) {
  if (fromState === toState) return `${label} stayed ${toState} for ${durationBars} bars.`;
  if (fromState === "neutral") return `${label} turned ${toState}.`;
  return `${label} flipped from ${fromState} to ${toState}.`;
}
function pairSeries(a, b, minSamples) {
  const length = Math.min(a.length, b.length);
  const x = [];
  const y = [];
  for (let index = 0; index < length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (!isFiniteNumber(left) || !isFiniteNumber(right)) continue;
    x.push(left);
    y.push(right);
  }
  if (x.length < minSamples) return null;
  return { x, y };
}
function bestLagCorrelation(a, b, maxLag, minSamples) {
  let bestBars = 0;
  let bestCorrelation = 0;
  for (let lag = -maxLag; lag <= maxLag; lag += 1) {
    const paired = pairSeriesWithLag(a, b, lag, minSamples);
    if (!paired) continue;
    const corr = pearsonCorrelation(paired.x, paired.y);
    if (Math.abs(corr) > Math.abs(bestCorrelation)) {
      bestCorrelation = corr;
      bestBars = lag;
    }
  }
  return { bars: bestBars, correlation: bestCorrelation };
}
function pairSeriesWithLag(a, b, lagBars, minSamples) {
  const x = [];
  const y = [];
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const bIndex = index + lagBars;
    if (bIndex < 0 || bIndex >= length) continue;
    const left = a[index];
    const right = b[bIndex];
    if (!isFiniteNumber(left) || !isFiniteNumber(right)) continue;
    x.push(left);
    y.push(right);
  }
  if (x.length < minSamples) return null;
  return { x, y };
}
function pearsonCorrelation(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumYY = 0;
  let sumXY = 0;
  for (let index = 0; index < n; index += 1) {
    const vx = x[index] ?? 0;
    const vy = y[index] ?? 0;
    sumX += vx;
    sumY += vy;
    sumXX += vx * vx;
    sumYY += vy * vy;
    sumXY += vx * vy;
  }
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
  if (denominator <= 0 || !isFiniteNumber(denominator)) return 0;
  const result = numerator / denominator;
  return isFiniteNumber(result) ? result : 0;
}
function spearmanCorrelation(x, y) {
  const rankedX = rankValues(x);
  const rankedY = rankValues(y);
  return pearsonCorrelation(rankedX, rankedY);
}
function rankValues(values) {
  const indexed = values.map((value, index) => ({ value, index }));
  indexed.sort((left, right) => left.value - right.value);
  const ranks = Array(values.length).fill(0);
  let cursor = 0;
  while (cursor < indexed.length) {
    let next = cursor + 1;
    while (next < indexed.length && indexed[next]?.value === indexed[cursor]?.value) {
      next += 1;
    }
    const averageRank = (cursor + next - 1) / 2 + 1;
    for (let index = cursor; index < next; index += 1) {
      const originalIndex = indexed[index]?.index;
      if (typeof originalIndex === "number") {
        ranks[originalIndex] = averageRank;
      }
    }
    cursor = next;
  }
  return ranks;
}
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function crossoverSeries(fast, slow) {
  const result = [null];
  for (let i = 1; i < fast.length; i++) {
    const prevFast = fast[i - 1];
    const prevSlow = slow[i - 1];
    const currFast = fast[i];
    const currSlow = slow[i];
    if (!isFiniteNumber(prevFast) || !isFiniteNumber(prevSlow) || !isFiniteNumber(currFast) || !isFiniteNumber(currSlow)) {
      result.push(null);
      continue;
    }
    if (prevFast <= prevSlow && currFast > currSlow) result.push(1);
    else if (prevFast >= prevSlow && currFast < currSlow) result.push(-1);
    else result.push(0);
  }
  return result;
}
function squeezeSeries(bbWidth, threshold) {
  const result = [null];
  for (let i = 1; i < bbWidth.length; i++) {
    const prev = bbWidth[i - 1];
    const curr = bbWidth[i];
    if (!isFiniteNumber(prev) || !isFiniteNumber(curr)) {
      result.push(null);
      continue;
    }
    if (prev < threshold && curr >= threshold) result.push(1);
    else result.push(0);
  }
  return result;
}
function bodyRatioZSeries(candles, period) {
  const bodies = candles.map((c) => Math.abs(c.close - c.open));
  const result = [];
  for (let i = 0; i < bodies.length; i++) {
    if (i < period) {
      result.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - period; j < i; j++) sum += bodies[j];
    const mean = sum / period;
    let sumSq = 0;
    for (let j = i - period; j < i; j++) {
      const d = bodies[j] - mean;
      sumSq += d * d;
    }
    const std = Math.sqrt(sumSq / period);
    if (std < 1e-9) {
      result.push(0);
      continue;
    }
    result.push((bodies[i] - mean) / std);
  }
  return result;
}
function donchianBreakSeries(donchianPos) {
  return donchianPos.map((v) => {
    if (!isFiniteNumber(v)) return null;
    if (v >= 1) return 1;
    if (v <= 0) return -1;
    return 0.5;
  });
}

// src/observatory/priceContext.ts
function buildPriceContext(input) {
  const generatedAtMs = input.generatedAtMs ?? Date.now();
  const latestCandleTime = input.candles[input.candles.length - 1]?.time ?? null;
  const latestClose = input.candles[input.candles.length - 1]?.close ?? null;
  const lastPrice = Number.isFinite(input.livePrice) ? input.livePrice : latestClose;
  const barsFor24h = input.interval === "4h" ? 6 : 1;
  const close24hAgo = input.candles[Math.max(0, input.candles.length - 1 - barsFor24h)]?.close ?? null;
  const closePrevious = input.candles[Math.max(0, input.candles.length - 2)]?.close ?? null;
  const change24hPct = lastPrice !== null && close24hAgo !== null && close24hAgo !== 0 ? (lastPrice - close24hAgo) / Math.abs(close24hAgo) * 100 : null;
  const intervalReturnPct = lastPrice !== null && closePrevious !== null && closePrevious !== 0 ? (lastPrice - closePrevious) / Math.abs(closePrevious) * 100 : null;
  const observedAtMs = Number.isFinite(lastPrice) ? input.livePriceObservedAtMs ?? latestCandleTime ?? generatedAtMs : latestCandleTime;
  return {
    lastPrice,
    change24hPct,
    intervalReturnPct,
    observedAt: Number.isFinite(observedAtMs) ? new Date(observedAtMs).toISOString() : null
  };
}

// src/observatory/analytics.ts
var ANALYTICS_CATEGORY_ORDER = ["Trend", "Momentum", "Volatility", "Volume", "Structure"];
function buildPersistedObservatoryAnalytics(input) {
  const barsByTime = /* @__PURE__ */ new Map();
  const indicatorOrder = [];
  const seenIndicators = /* @__PURE__ */ new Set();
  const categoryByIndicator = /* @__PURE__ */ new Map();
  for (const row of input.rows) {
    let bar = barsByTime.get(row.candleTime);
    if (!bar) {
      bar = /* @__PURE__ */ new Map();
      barsByTime.set(row.candleTime, bar);
    }
    bar.set(row.indicatorId, { category: row.category, isOn: row.isOn });
    if (!seenIndicators.has(row.indicatorId)) {
      seenIndicators.add(row.indicatorId);
      indicatorOrder.push(row.indicatorId);
      categoryByIndicator.set(row.indicatorId, row.category);
    }
  }
  const times = [...barsByTime.keys()].sort((left, right) => left - right);
  const rows = indicatorOrder.map((indicatorId) => ({
    indicatorId,
    category: categoryByIndicator.get(indicatorId) ?? "Trend",
    activeBars: 0,
    activeRate: 0,
    transitionRate: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastHitTime: null,
    recentHitTimes: []
  }));
  const rowByIndicator = new Map(rows.map((row) => [row.indicatorId, row]));
  const liveStreaks = new Map(indicatorOrder.map((indicatorId) => [indicatorId, 0]));
  const categoryTotalHits = new Map(ANALYTICS_CATEGORY_ORDER.map((category) => [category, 0]));
  const categoryActiveBars = new Map(ANALYTICS_CATEGORY_ORDER.map((category) => [category, 0]));
  for (const time of times) {
    const bar = barsByTime.get(time);
    if (!bar) continue;
    const barLaneCounts = /* @__PURE__ */ new Map();
    for (const indicatorId of indicatorOrder) {
      const state = bar.get(indicatorId);
      const row = rowByIndicator.get(indicatorId);
      if (!row) continue;
      const isOn = state?.isOn ?? false;
      if (isOn) {
        row.activeBars += 1;
        row.lastHitTime = time;
        row.recentHitTimes.push(time);
        const nextStreak = (liveStreaks.get(indicatorId) ?? 0) + 1;
        liveStreaks.set(indicatorId, nextStreak);
        row.maxStreak = Math.max(row.maxStreak, nextStreak);
        barLaneCounts.set(row.category, (barLaneCounts.get(row.category) ?? 0) + 1);
      } else {
        liveStreaks.set(indicatorId, 0);
      }
    }
    for (const category of ANALYTICS_CATEGORY_ORDER) {
      const laneCount = barLaneCounts.get(category) ?? 0;
      categoryTotalHits.set(category, (categoryTotalHits.get(category) ?? 0) + laneCount);
      if (laneCount > 0) {
        categoryActiveBars.set(category, (categoryActiveBars.get(category) ?? 0) + 1);
      }
    }
  }
  const windowBars = Math.max(times.length, 1);
  for (const row of rows) {
    row.activeRate = row.activeBars / windowBars;
    const states = times.map((time) => barsByTime.get(time)?.get(row.indicatorId)?.isOn ?? false);
    let transitions = 0;
    for (let index = 1; index < states.length; index += 1) {
      if (states[index] !== states[index - 1]) {
        transitions += 1;
      }
    }
    row.transitionRate = transitions / Math.max(states.length - 1, 1);
    row.currentStreak = liveStreaks.get(row.indicatorId) ?? 0;
    row.recentHitTimes = row.recentHitTimes.slice(-4).reverse();
  }
  rows.sort((left, right) => right.activeBars - left.activeBars || right.activeRate - left.activeRate || right.maxStreak - left.maxStreak);
  return {
    coin: input.coin,
    interval: input.interval,
    days: input.days,
    windowBars: times.length,
    totalHits: rows.reduce((sum, row) => sum + row.activeBars, 0),
    lastPersistedBarTime: times[times.length - 1] ?? null,
    rows,
    categoryRows: ANALYTICS_CATEGORY_ORDER.map((category) => ({
      category,
      totalHits: categoryTotalHits.get(category) ?? 0,
      activeRate: (categoryActiveBars.get(category) ?? 0) / windowBars
    })).sort((left, right) => right.totalHits - left.totalHits)
  };
}

// src/observatory/version.ts
var OBSERVATORY_RULESET_VERSION = "2026-03-12.1";

// src/observatory/persistence.ts
var INTERVAL_MS = {
  "1h": 36e5,
  "4h": 144e5,
  "1d": 864e5
};
function intervalToMs2(interval) {
  return INTERVAL_MS[interval];
}
function getClosedBarTimes(snapshot, now = Date.now()) {
  const intervalMs = intervalToMs2(snapshot.interval);
  return snapshot.barStates.map((barState) => barState.time).filter((time) => time + intervalMs <= now);
}
function buildClosedIndicatorStateRecords(snapshot, options = {}) {
  const now = options.now ?? Date.now();
  const closedBarTimes = new Set(getClosedBarTimes(snapshot, now));
  return buildIndicatorStateRecords(snapshot).filter((record) => closedBarTimes.has(record.candleTime));
}
export {
  OBSERVATORY_RULESET_VERSION,
  TRACKED_COINS,
  buildClosedIndicatorStateRecords,
  buildIndicatorStateRecords,
  buildObservatorySnapshot,
  buildPersistedObservatoryAnalytics,
  buildPriceContext,
  getClosedBarTimes,
  parseCandle
};

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

// src/signals/hurst.ts
var MIN_PERIODS = 100;
function computeHurst(closes, period = MIN_PERIODS) {
  const available = closes.length;
  const confidence = Math.min(1, available / period);
  if (available < 3) {
    return {
      value: 0.5,
      regime: "choppy",
      color: "yellow",
      confidence: 0,
      explanation: "Not enough data yet to determine market type."
    };
  }
  const window = closes.slice(-Math.min(available, period + 1));
  const returns = [];
  for (let i = 1; i < window.length; i++) {
    const prev = window[i - 1];
    const curr = window[i];
    if (prev > 0 && curr > 0) {
      returns.push(Math.log(curr / prev));
    }
  }
  if (returns.length < 2) {
    return {
      value: 0.5,
      regime: "choppy",
      color: "yellow",
      confidence: 0,
      explanation: "Not enough data yet to determine market type."
    };
  }
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
  if (variance === 0) {
    return {
      value: 0.5,
      regime: "choppy",
      color: "yellow",
      confidence,
      explanation: "Price has not moved \u2014 no trend or mean-reversion detected."
    };
  }
  let autocovariance = 0;
  for (let i = 1; i < returns.length; i++) {
    autocovariance += (returns[i] - mean) * (returns[i - 1] - mean);
  }
  autocovariance /= returns.length;
  const acf1 = autocovariance / variance;
  const H = Math.max(0, Math.min(1, 0.5 + acf1));
  const regime = classifyRegime(H);
  const color = regimeColor(regime);
  const explanation = buildExplanation(H, regime, confidence);
  return { value: H, regime, color, confidence, explanation };
}
function classifyRegime(H) {
  if (H > 0.55) return "trending";
  if (H < 0.45) return "mean-reverting";
  return "choppy";
}
function regimeColor(regime) {
  switch (regime) {
    case "mean-reverting":
      return "green";
    case "trending":
      return "yellow";
    case "choppy":
      return "red";
  }
}
function buildExplanation(H, regime, confidence) {
  if (confidence < 0.5) {
    return "Still gathering data \u2014 market type will become clearer over the next few hours.";
  }
  switch (regime) {
    case "trending":
      return H > 0.65 ? "The market is trending strongly in one direction \u2014 mean-reversion signals are unreliable here. Consider sitting this one out or trading with the trend." : "The market is showing mild trending behavior \u2014 signals may be less reliable than usual.";
    case "mean-reverting":
      return H < 0.4 ? "The market is strongly bouncing between levels \u2014 this is ideal for our signals. Prices that stretch far from average tend to snap back." : "The market is bouncing between levels \u2014 good conditions for our signals.";
    case "choppy":
      return "The market is moving without a clear pattern \u2014 neither trending nor bouncing predictably. Signals are unreliable, consider waiting for clarity.";
  }
}

// src/signals/zscore.ts
function computeZScore(closes, period = 20) {
  if (closes.length < period) {
    return {
      value: 0,
      normalizedSignal: 0,
      label: "Insufficient Data",
      color: "yellow",
      explanation: `Need at least ${period} candles to calculate price position. Currently have ${closes.length}.`
    };
  }
  const window = closes.slice(-period);
  const current = closes[closes.length - 1];
  const mean = window.reduce((s, v) => s + v, 0) / period;
  const variance = window.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
  const stddev = Math.sqrt(variance);
  if (stddev === 0) {
    return {
      value: 0,
      normalizedSignal: 0,
      label: "No Movement",
      color: "yellow",
      explanation: "Price has been flat \u2014 no position signal."
    };
  }
  const z = (current - mean) / stddev;
  const normalizedSignal = Math.max(-1, Math.min(1, -z / 3));
  const { label, color } = classifyZScore(z);
  const explanation = buildExplanation2(z, current, mean);
  return { value: z, normalizedSignal, label, color, explanation };
}
function classifyZScore(z) {
  const abs = Math.abs(z);
  if (abs > 2.5) {
    return {
      label: z > 0 ? "Extremely Overbought" : "Extremely Oversold",
      color: "green"
      // extreme = opportunity for mean-reversion
    };
  }
  if (abs > 2) {
    return {
      label: z > 0 ? "Strongly Overbought" : "Strongly Oversold",
      color: "green"
    };
  }
  if (abs > 1) {
    return {
      label: z > 0 ? "Overbought" : "Oversold",
      color: "yellow"
    };
  }
  return {
    label: "Normal Range",
    color: "red"
    // no opportunity
  };
}
function buildExplanation2(z, current, mean) {
  const abs = Math.abs(z);
  const direction = z > 0 ? "above" : "below";
  const reverseAction = z > 0 ? "drop back down" : "bounce back up";
  const priceStr = current.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const meanStr = mean.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (abs > 2) {
    return `Price ($${priceStr}) is ${abs.toFixed(1)} std devs ${direction} the 20-period average ($${meanStr}) \u2014 unusually ${z > 0 ? "expensive" : "cheap"}, often means it will ${reverseAction}. Strong contrarian signal.`;
  }
  if (abs > 1) {
    return `Price ($${priceStr}) is ${abs.toFixed(1)} std devs ${direction} the average ($${meanStr}) \u2014 starting to look ${z > 0 ? "expensive" : "cheap"}, but not extreme yet.`;
  }
  return `Price ($${priceStr}) is near its 20-period average ($${meanStr}) \u2014 nothing unusual. No signal from price position.`;
}

// src/signals/funding.ts
function computeFundingZScore(history, windowSize = 30) {
  const minRequired = 8;
  if (history.length < minRequired) {
    return {
      currentRate: history.length > 0 ? history[history.length - 1].rate : 0,
      zScore: 0,
      normalizedSignal: 0,
      label: "Insufficient Data",
      color: "yellow",
      explanation: `Need at least ${minRequired} funding rate snapshots. Currently have ${history.length}.`
    };
  }
  const window = history.slice(-windowSize);
  const currentRate = history[history.length - 1].rate;
  const rates = window.map((s) => s.rate);
  const mean = rates.reduce((s, v) => s + v, 0) / rates.length;
  const variance = rates.reduce((s, v) => s + (v - mean) ** 2, 0) / rates.length;
  const stddev = Math.sqrt(variance);
  if (stddev === 0) {
    return {
      currentRate,
      zScore: 0,
      normalizedSignal: 0,
      label: "Flat Funding",
      color: "yellow",
      explanation: "Funding rates have been steady \u2014 no extreme crowd positioning detected."
    };
  }
  const zScore = (currentRate - mean) / stddev;
  const normalizedSignal = Math.max(-1, Math.min(1, -zScore / 3));
  const { label, color } = classifyFunding(zScore, currentRate);
  const explanation = buildExplanation3(zScore, currentRate);
  return { currentRate, zScore, normalizedSignal, label, color, explanation };
}
function classifyFunding(z, _rate) {
  const abs = Math.abs(z);
  if (abs > 2) {
    return {
      label: z > 0 ? "Extreme Longs" : "Extreme Shorts",
      color: "green"
      // extreme = contrarian opportunity
    };
  }
  if (abs > 1) {
    return {
      label: z > 0 ? "Crowded Long" : "Crowded Short",
      color: "yellow"
    };
  }
  return {
    label: "Balanced",
    color: "red"
    // no edge
  };
}
function buildExplanation3(z, rate) {
  const abs = Math.abs(z);
  const rateStr = (rate * 100).toFixed(4);
  const zStr = z.toFixed(2);
  if (abs > 2) {
    if (z > 0) {
      return `The crowd is extremely long (funding: ${rateStr}%, z-score: ${zStr}). When everyone bets the same way, the market often moves against them. Strong contrarian SHORT signal.`;
    }
    return `The crowd is extremely short (funding: ${rateStr}%, z-score: ${zStr}). Extreme bearish positioning often leads to a squeeze upward. Strong contrarian LONG signal.`;
  }
  if (abs > 1) {
    if (z > 0) {
      return `More traders are long than usual (funding: ${rateStr}%, z-score: ${zStr}). Mild contrarian signal \u2014 the crowd could be wrong.`;
    }
    return `More traders are short than usual (funding: ${rateStr}%, z-score: ${zStr}). Mild contrarian signal \u2014 shorts may get squeezed.`;
  }
  return `Crowd positioning is balanced (funding: ${rateStr}%, z-score: ${zStr}). No strong contrarian signal \u2014 the crowd isn't extreme.`;
}

// src/signals/oiDelta.ts
function computeOIDelta(oiHistory, closes, windowSize = 5) {
  const minRequired = Math.max(2, windowSize + 1);
  if (oiHistory.length < minRequired || closes.length < minRequired) {
    return {
      oiChangePct: 0,
      priceChangePct: 0,
      confirmation: false,
      normalizedSignal: 0,
      label: "Insufficient Data",
      color: "yellow",
      explanation: `Need at least ${minRequired} data points to measure money flow. Currently have ${oiHistory.length}.`
    };
  }
  const recentOI = oiHistory.slice(-windowSize);
  const olderOI = oiHistory.slice(-(windowSize * 2), -windowSize);
  const avgRecentOI = recentOI.reduce((s, v) => s + v.oi, 0) / recentOI.length;
  const avgOlderOI = olderOI.length > 0 ? olderOI.reduce((s, v) => s + v.oi, 0) / olderOI.length : oiHistory[oiHistory.length - minRequired].oi;
  const recentCloses = closes.slice(-windowSize);
  const olderClose = closes[closes.length - minRequired];
  const avgRecentPrice = recentCloses.reduce((s, v) => s + v, 0) / recentCloses.length;
  const oiChangePct = avgOlderOI > 0 ? (avgRecentOI - avgOlderOI) / avgOlderOI : 0;
  const priceChangePct = olderClose > 0 ? (avgRecentPrice - olderClose) / olderClose : 0;
  const oiUp = oiChangePct > 5e-3;
  const oiDown = oiChangePct < -5e-3;
  const priceUp = priceChangePct > 2e-3;
  const priceDown = priceChangePct < -2e-3;
  let confirmation;
  let normalizedSignal;
  let label;
  let color;
  let explanation;
  if (oiUp && priceUp) {
    confirmation = true;
    normalizedSignal = 0.5 + Math.min(0.5, Math.abs(oiChangePct) * 10);
    label = "Confirmed Bullish";
    color = "green";
    explanation = "New money is flowing IN while price goes UP \u2014 the move is backed by real conviction. This is a strong bullish sign.";
  } else if (oiUp && priceDown) {
    confirmation = true;
    normalizedSignal = -(0.5 + Math.min(0.5, Math.abs(oiChangePct) * 10));
    label = "Confirmed Bearish";
    color = "green";
    explanation = "New money is flowing IN while price goes DOWN \u2014 fresh sellers are entering. This is a strong bearish sign.";
  } else if (oiDown && priceUp) {
    confirmation = false;
    normalizedSignal = 0.2;
    label = "Weak Rally";
    color = "yellow";
    explanation = "Price is going up but money is LEAVING the market \u2014 shorts are closing, not new buyers entering. The rally looks weak and may reverse.";
  } else if (oiDown && priceDown) {
    confirmation = false;
    normalizedSignal = -0.2;
    label = "Weak Decline";
    color = "yellow";
    explanation = "Price is going down but money is LEAVING \u2014 longs are closing, not new sellers entering. The decline looks weak and may bounce.";
  } else {
    confirmation = false;
    normalizedSignal = 0;
    label = "No Clear Flow";
    color = "red";
    explanation = "Neither price nor open interest is moving significantly \u2014 no clear money flow signal.";
  }
  return {
    oiChangePct,
    priceChangePct,
    confirmation,
    normalizedSignal: Math.max(-1, Math.min(1, normalizedSignal)),
    label,
    color,
    explanation
  };
}

// src/signals/volatility.ts
function computeATR(candles, period = 14) {
  if (candles.length < 2) return 0;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prev.close),
      Math.abs(curr.low - prev.close)
    );
    trs.push(tr);
  }
  if (trs.length === 0) return 0;
  if (trs.length < period) {
    return trs.reduce((sum, value) => sum + value, 0) / trs.length;
  }
  let atr = trs.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return atr;
}
function computeRealizedVol(closes, period = 20) {
  if (closes.length < period + 1) {
    return {
      realizedVol: 0,
      atr: 0,
      level: "normal",
      color: "yellow",
      explanation: `Need at least ${period + 1} candles to measure volatility. Currently have ${closes.length}.`
    };
  }
  const window = closes.slice(-(period + 1));
  const returns = [];
  for (let i = 1; i < window.length; i++) {
    const prev = window[i - 1];
    const curr = window[i];
    if (prev > 0 && curr > 0) {
      returns.push(Math.log(curr / prev));
    }
  }
  if (returns.length < 2) {
    return {
      realizedVol: 0,
      atr: 0,
      level: "normal",
      color: "yellow",
      explanation: "Not enough price movement to measure volatility."
    };
  }
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length;
  const hourlyVol = Math.sqrt(variance);
  const annualizedVol = hourlyVol * Math.sqrt(8760) * 100;
  const { level, color } = classifyVol(annualizedVol);
  const explanation = buildExplanation4(annualizedVol, level);
  return { realizedVol: annualizedVol, atr: 0, level, color, explanation };
}
function classifyVol(vol) {
  if (vol > 140) return { level: "extreme", color: "red" };
  if (vol > 90) return { level: "high", color: "yellow" };
  if (vol > 50) return { level: "normal", color: "green" };
  return { level: "low", color: "green" };
}
function buildExplanation4(vol, level) {
  const volStr = vol.toFixed(1);
  switch (level) {
    case "extreme":
      return `Volatility is EXTREME (${volStr}% annualized) - price is swinging wildly. Use much lower leverage and very wide stops, or sit this out entirely.`;
    case "high":
      return `Volatility is HIGH (${volStr}% annualized) - price is swinging a lot. Use lower leverage and wider stops than usual.`;
    case "normal":
      return `Volatility is NORMAL for crypto (${volStr}% annualized) - active but not extreme. Standard position sizing and stops are appropriate.`;
    case "low":
      return `Volatility is LOW (${volStr}% annualized) - price is calm and stable. Tighter stops are safer, and slightly higher leverage is more reasonable.`;
  }
}

// src/signals/entryGeometry.ts
function computeEntryGeometry(closes, atr, period = 20) {
  if (closes.length < period) {
    return {
      distanceFromMeanPct: 0,
      stretchZEquivalent: 0,
      atrDislocation: 0,
      bandPosition: 0.5,
      meanPrice: 0,
      reversionPotential: 0,
      chaseRisk: 0.25,
      entryQuality: "no-edge",
      directionBias: "neutral",
      color: "yellow",
      explanation: `Need at least ${period} closes to score entry geometry. Currently have ${closes.length}.`
    };
  }
  const window = closes.slice(-period);
  const current = window[window.length - 1];
  const mean = window.reduce((sum, value) => sum + value, 0) / window.length;
  const variance = window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / window.length;
  const stddev = Math.sqrt(variance);
  if (stddev === 0 || mean <= 0) {
    return {
      distanceFromMeanPct: 0,
      stretchZEquivalent: 0,
      atrDislocation: 0,
      bandPosition: 0.5,
      meanPrice: mean,
      reversionPotential: 0,
      chaseRisk: 0.2,
      entryQuality: "no-edge",
      directionBias: "neutral",
      color: "yellow",
      explanation: "Price is too flat to score a meaningful entry edge."
    };
  }
  const z = (current - mean) / stddev;
  const distanceFromMeanPct = (current - mean) / mean * 100;
  const atrDislocation = atr > 0 ? Math.abs(current - mean) / atr : 0;
  const bandPosition = clamp((z + 2.5) / 5, 0, 1);
  const directionBias = z < -0.35 ? "long" : z > 0.35 ? "short" : "neutral";
  const absZ = Math.abs(z);
  const reversionPotential = clamp((absZ - 0.6) / 1.8, 0, 1);
  const chaseRisk = clamp((2.8 - absZ) / 2.8, 0, 1);
  const entryQuality = classifyEntryQuality(absZ, atrDislocation);
  const color = entryColor(entryQuality);
  const explanation = buildExplanation5(current, mean, z, atrDislocation, entryQuality);
  return {
    distanceFromMeanPct,
    stretchZEquivalent: z,
    atrDislocation,
    bandPosition,
    meanPrice: mean,
    reversionPotential,
    chaseRisk,
    entryQuality,
    directionBias,
    color,
    explanation
  };
}
function classifyEntryQuality(absZ, atrDislocation) {
  if (absZ < 0.75) return "no-edge";
  if (absZ < 1.25) return "early";
  if (atrDislocation < 0.8 && absZ < 2.4) return "early";
  if (absZ <= 2.4 && atrDislocation <= 2.4) return "ideal";
  if (absZ <= 3.2 && atrDislocation <= 3.4) return "extended";
  return "chasing";
}
function entryColor(entryQuality) {
  switch (entryQuality) {
    case "ideal":
      return "green";
    case "extended":
    case "early":
      return "yellow";
    case "chasing":
    case "no-edge":
      return "red";
  }
}
function buildExplanation5(current, mean, z, atrDislocation, entryQuality) {
  const side = z > 0 ? "above" : "below";
  const direction = z > 0 ? "short" : "long";
  switch (entryQuality) {
    case "ideal":
      return `Price is ${Math.abs(z).toFixed(2)} standard deviations ${side} fair value with ${atrDislocation.toFixed(2)} ATRs of stretch. This is the sweet spot for a ${direction} fade.`;
    case "extended":
      return `Price is deeply stretched (${Math.abs(z).toFixed(2)}\u03C3, ${atrDislocation.toFixed(2)} ATRs). The setup is still actionable, but slippage and violent snap-backs are more likely.`;
    case "early":
      return `Price is leaning away from fair value but has not stretched enough yet (${Math.abs(z).toFixed(2)}\u03C3, ${atrDislocation.toFixed(2)} ATRs). Let it travel further before leaning in.`;
    case "chasing":
      return `Price is too far from equilibrium (${Math.abs(z).toFixed(2)}\u03C3). The move is likely already overextended, so chasing here carries poor geometry.`;
    case "no-edge":
      return `Price (${current.toFixed(2)}) is still hugging its mean (${mean.toFixed(2)}). The rubber band has not stretched enough to create a clean mean-reversion edge.`;
  }
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// src/signals/composite.ts
function computeComposite(hurst, zScore, funding, oiDelta) {
  const directionalSignals = [
    zScore.normalizedSignal,
    funding.normalizedSignal,
    oiDelta.normalizedSignal
  ];
  const rawComposite = directionalSignals.reduce((s, v) => s + v, 0) / directionalSignals.length;
  let regimeMultiplier;
  if (hurst.value < 0.45) {
    regimeMultiplier = 1 + (0.45 - hurst.value) * 3;
  } else if (hurst.value > 0.55) {
    regimeMultiplier = 0.7 - (hurst.value - 0.55) * 2;
  } else {
    regimeMultiplier = 0.7 + (0.55 - hurst.value) * 3;
  }
  regimeMultiplier = Math.max(0.1, Math.min(1.3, regimeMultiplier));
  const composite = Math.max(-1, Math.min(1, rawComposite * regimeMultiplier));
  const direction = classifyDirection(composite);
  const positiveCount = directionalSignals.filter((s) => s > 0.1).length;
  const negativeCount = directionalSignals.filter((s) => s < -0.1).length;
  const agreementCount = Math.max(positiveCount, negativeCount);
  const hurstAgreesWithDirection = hurst.regime === "mean-reverting";
  const hurstCounted = hurst.regime !== "choppy";
  const displayAgreement = agreementCount + (hurstAgreesWithDirection ? 1 : 0);
  const displayTotal = directionalSignals.length + (hurstCounted ? 1 : 0);
  const signalBreakdown = [
    {
      name: "Price Position",
      direction: zScore.normalizedSignal > 0.1 ? "long" : zScore.normalizedSignal < -0.1 ? "short" : "neutral",
      agrees: direction !== "neutral" && (direction === "long" && zScore.normalizedSignal > 0.1 || direction === "short" && zScore.normalizedSignal < -0.1)
    },
    {
      name: "Crowd Positioning",
      direction: funding.normalizedSignal > 0.1 ? "long" : funding.normalizedSignal < -0.1 ? "short" : "neutral",
      agrees: direction !== "neutral" && (direction === "long" && funding.normalizedSignal > 0.1 || direction === "short" && funding.normalizedSignal < -0.1)
    },
    {
      name: "Money Flow",
      direction: oiDelta.normalizedSignal > 0.1 ? "long" : oiDelta.normalizedSignal < -0.1 ? "short" : "neutral",
      agrees: direction !== "neutral" && (direction === "long" && oiDelta.normalizedSignal > 0.1 || direction === "short" && oiDelta.normalizedSignal < -0.1)
    }
  ];
  const strength = classifyStrength(composite);
  const color = compositeColor(composite);
  const label = buildLabel(direction, strength);
  const explanation = buildExplanation6(direction, strength, signalBreakdown, hurst);
  return {
    value: composite,
    direction,
    strength,
    agreementCount: displayAgreement,
    agreementTotal: displayTotal,
    color,
    label,
    explanation,
    signalBreakdown
  };
}
function classifyDirection(v) {
  if (v > 0.1) return "long";
  if (v < -0.1) return "short";
  return "neutral";
}
function classifyStrength(v) {
  const abs = Math.abs(v);
  if (abs > 0.5) return "strong";
  if (abs > 0.2) return "moderate";
  return "weak";
}
function compositeColor(v) {
  const abs = Math.abs(v);
  if (abs > 0.3) return "green";
  if (abs > 0.1) return "yellow";
  return "red";
}
function buildLabel(direction, strength) {
  if (direction === "neutral") return "STAY OUT";
  const strengthWord = strength === "strong" ? "STRONG" : strength === "moderate" ? "MODERATE" : "WEAK";
  return `${strengthWord} ${direction.toUpperCase()}`;
}
function buildExplanation6(direction, strength, breakdown, hurst) {
  if (direction === "neutral") {
    return "Signals are mixed with no clear direction. The safest move is to wait for stronger alignment before entering a trade.";
  }
  const dirWord = direction === "long" ? "LONG" : "SHORT";
  const strengthWord = strength === "strong" ? "high" : strength === "moderate" ? "moderate" : "low";
  const agreeing = breakdown.filter((s) => s.agrees).map((s) => s.name);
  const disagreeing = breakdown.filter((s) => !s.agrees).map((s) => s.name);
  let signalDetail = "";
  if (agreeing.length > 0) signalDetail += `${agreeing.join(" and ")} support this.`;
  if (disagreeing.length > 0) signalDetail += ` ${disagreeing.join(" and ")} ${disagreeing.length === 1 ? "disagrees" : "disagree"}.`;
  let regimeNote = "";
  if (hurst.regime === "mean-reverting") {
    regimeNote = " Market regime is favorable for this signal.";
  } else if (hurst.regime === "trending") {
    regimeNote = " However, the market is trending, which makes mean-reversion signals less reliable.";
  } else {
    regimeNote = " Market conditions are unclear, so take this with caution.";
  }
  return `${dirWord} with ${strengthWord} conviction. ${signalDetail}${regimeNote}`;
}

// src/signals/decision.ts
function computeDecisionState(input) {
  const {
    composite,
    entryGeometry,
    hurst,
    isStale,
    isWarmingUp,
    riskStatus = "unknown"
  } = input;
  const reasons = [];
  if (isStale) {
    return {
      action: "avoid",
      label: "AVOID",
      reasons: ["stale feed", "refresh needed"]
    };
  }
  if (isWarmingUp) {
    return {
      action: "wait",
      label: "WAIT",
      reasons: ["warming up", "signals incomplete"]
    };
  }
  const regimeBlocks = hurst.regime === "trending" && hurst.value > 0.6;
  const neutralComposite = composite.direction === "neutral" || composite.strength === "weak";
  const entryWeak = entryGeometry.entryQuality === "no-edge" || entryGeometry.directionBias === "neutral";
  if (regimeBlocks) reasons.push("trend veto");
  if (neutralComposite) reasons.push("mixed signals");
  if (entryWeak) reasons.push("no stretch");
  if (riskStatus === "danger") reasons.push("risk too large");
  if (riskStatus === "borderline") reasons.push("risk tight");
  const geometrySupportsDirection = composite.direction === "long" && entryGeometry.directionBias === "long" || composite.direction === "short" && entryGeometry.directionBias === "short";
  const geometryStrong = entryGeometry.entryQuality === "ideal" || entryGeometry.entryQuality === "extended";
  const directionalComposite = composite.direction === "long" || composite.direction === "short";
  if (directionalComposite && !neutralComposite && geometryStrong && geometrySupportsDirection && !regimeBlocks && riskStatus !== "danger") {
    const reasonsOut = [
      `${Math.abs(entryGeometry.stretchZEquivalent).toFixed(1)}\u03C3 stretched`,
      composite.agreementCount >= 3 ? "signals aligned" : "partial agreement",
      hurst.regime === "mean-reverting" ? "mean-reverting regime" : "regime acceptable"
    ];
    if (riskStatus === "safe") reasonsOut.push("risk clear");
    if (riskStatus === "borderline") reasonsOut.push("risk tight");
    return {
      action: composite.direction === "long" ? "long" : "short",
      label: composite.direction === "long" ? "ENTER LONG" : "ENTER SHORT",
      reasons: reasonsOut
    };
  }
  if (riskStatus === "danger" || regimeBlocks) {
    return {
      action: "avoid",
      label: "AVOID",
      reasons: dedupe(reasons)
    };
  }
  return {
    action: "wait",
    label: "WAIT",
    reasons: dedupe(reasons.length > 0 ? reasons : ["setup developing"])
  };
}
function dedupe(values) {
  return Array.from(new Set(values)).slice(0, 4);
}

// src/signals/risk.ts
function computeRisk(inputs, atr) {
  const { direction, entryPrice, accountSize, positionSize, leverage, stopPrice, targetPrice } = inputs;
  const hasPositionSizeInput = positionSize > 0;
  if (entryPrice <= 0 || accountSize <= 0 || leverage <= 0) {
    return emptyOutputs();
  }
  if (stopPrice !== null && stopPrice === entryPrice) {
    return invalidInputOutputs("Stop cannot equal entry price.");
  }
  const maintenanceMarginRate = 5e-3;
  let liquidationPrice = 0;
  let hasLiquidation = false;
  let effectiveImmune = false;
  let liquidationDistance = 0;
  let liquidationFallback = null;
  let liquidationFallbackExplanation = null;
  if (hasPositionSizeInput) {
    const effectivePos = positionSize;
    const marginUsed = effectivePos / leverage;
    const availableMargin = accountSize - marginUsed;
    const maintenanceMargin = effectivePos * maintenanceMarginRate;
    const marginBuffer = availableMargin - maintenanceMargin;
    if (marginBuffer <= 0) {
      liquidationPrice = entryPrice;
    } else if (marginBuffer >= effectivePos) {
      liquidationPrice = direction === "long" ? 0 : Infinity;
    } else {
      liquidationPrice = direction === "long" ? entryPrice * (1 - marginBuffer / effectivePos) : entryPrice * (1 + marginBuffer / effectivePos);
    }
    if (direction === "long") {
      liquidationPrice = Math.max(0, liquidationPrice);
    }
    hasLiquidation = Number.isFinite(liquidationPrice) && liquidationPrice > 0;
    effectiveImmune = !hasLiquidation;
    liquidationDistance = liquidationPrice === Infinity || liquidationPrice <= 0 ? 100 : Math.abs(liquidationPrice - entryPrice) / entryPrice * 100;
    liquidationFallback = effectiveImmune ? findMinimumLiquidationScenario(inputs) : null;
    liquidationFallbackExplanation = liquidationFallback?.explanation ?? null;
  } else {
    liquidationFallbackExplanation = "Enter a position size to calculate liquidation.";
  }
  const atrStop = atr > 0 ? atr * 1.5 : entryPrice * 0.02;
  const suggestedStopPrice = direction === "long" ? entryPrice - atrStop : entryPrice + atrStop;
  const stopValidationMessage = validateStop(direction, entryPrice, stopPrice);
  const usedCustomStop = stopPrice !== null && stopValidationMessage === null;
  const effectiveStopPrice = usedCustomStop ? stopPrice : suggestedStopPrice;
  const stopDistance = Math.abs(entryPrice - effectiveStopPrice);
  const effectivePositionSize = positionSize > 0 ? positionSize : accountSize * leverage;
  const lossAtStop = effectivePositionSize * (stopDistance / entryPrice);
  const lossAtStopPercent = accountSize > 0 ? lossAtStop / accountSize * 100 : 0;
  const suggestedTargetPrice = direction === "long" ? entryPrice + stopDistance * 2 : entryPrice - stopDistance * 2;
  const targetValidationMessage = validateTarget(direction, entryPrice, targetPrice);
  const usedCustomTarget = targetPrice !== null && targetValidationMessage === null;
  const effectiveTargetPrice = usedCustomTarget ? targetPrice : suggestedTargetPrice;
  const targetDistance = Math.abs(effectiveTargetPrice - entryPrice);
  const profitAtTarget = effectivePositionSize * (targetDistance / entryPrice);
  const profitAtTargetPercent = accountSize > 0 ? profitAtTarget / accountSize * 100 : 0;
  const rrRatio = stopDistance > 0 ? targetDistance / stopDistance : 0;
  const riskPerUnit = stopDistance / entryPrice;
  const suggestedPositionSize = riskPerUnit > 0 ? accountSize * 0.01 / riskPerUnit : 0;
  const suggestedLeverage = entryPrice > 0 ? suggestedPositionSize / (accountSize > 0 ? accountSize : 1) : 1;
  const { tradeGrade, tradeGradeLabel, tradeGradeExplanation } = gradeTradeSetup({
    liquidationDistance,
    lossAtStopPercent,
    rrRatio,
    leverage,
    stopDistance,
    atr,
    entryPrice
  });
  return {
    liquidationPrice,
    liquidationDistance,
    hasLiquidation,
    effectiveImmune,
    minLeverageForLiquidation: liquidationFallback?.leverage ?? null,
    liquidationPriceAtMinLeverage: liquidationFallback?.price ?? null,
    liquidationDistanceAtMinLeverage: liquidationFallback?.distancePct ?? null,
    liquidationFallbackExplanation,
    hasInputError: false,
    inputErrorMessage: null,
    suggestedStopPrice,
    effectiveStopPrice,
    usedCustomStop,
    stopValidationMessage,
    lossAtStop,
    lossAtStopPercent,
    suggestedTargetPrice,
    effectiveTargetPrice,
    usedCustomTarget,
    targetValidationMessage,
    profitAtTarget,
    profitAtTargetPercent,
    rrRatio,
    suggestedPositionSize,
    suggestedLeverage,
    tradeGrade,
    tradeGradeLabel,
    tradeGradeExplanation
  };
}
function gradeTradeSetup(input) {
  const issues = [];
  let score = 0;
  if (input.liquidationDistance >= 100) score += 2;
  else if (input.liquidationDistance > 20) score += 2;
  else if (input.liquidationDistance > 10) score += 1;
  else {
    issues.push(`Liquidation is only ${input.liquidationDistance.toFixed(1)}% away \u2014 very tight`);
  }
  if (input.lossAtStopPercent < 1) score += 2;
  else if (input.lossAtStopPercent < 2) score += 1;
  else if (input.lossAtStopPercent < 5) {
    issues.push(`Risking ${input.lossAtStopPercent.toFixed(1)}% of your account \u2014 consider reducing size`);
  } else {
    issues.push(`Risking ${input.lossAtStopPercent.toFixed(1)}% of your account \u2014 that's too much`);
  }
  if (input.rrRatio >= 3) score += 2;
  else if (input.rrRatio >= 2) score += 1;
  else if (input.rrRatio >= 1) {
    issues.push(`R:R of ${input.rrRatio.toFixed(1)}:1 is borderline \u2014 look for 2:1 minimum`);
  } else {
    issues.push(`R:R of ${input.rrRatio.toFixed(1)}:1 \u2014 the reward doesn't justify the risk`);
  }
  if (input.leverage <= 5) score += 1;
  else if (input.leverage <= 10) {
  } else if (input.leverage <= 20) {
    issues.push(`Leverage of ${input.leverage}x is aggressive`);
  } else {
    issues.push(`Leverage of ${input.leverage}x is very high \u2014 small moves can liquidate you`);
  }
  if (input.atr > 0) {
    const stopInATR = input.stopDistance / input.atr;
    if (stopInATR < 1) {
      issues.push("Stop is within normal price noise \u2014 it will likely get hit randomly");
    }
  }
  let tradeGrade;
  let tradeGradeLabel;
  if (score >= 5 && issues.length === 0) {
    tradeGrade = "green";
    tradeGradeLabel = "GOOD SETUP";
  } else if (score >= 3 && issues.length <= 1) {
    tradeGrade = "yellow";
    tradeGradeLabel = "BORDERLINE";
  } else {
    tradeGrade = "red";
    tradeGradeLabel = "TOO RISKY";
  }
  const tradeGradeExplanation = issues.length > 0 ? `${tradeGradeLabel} \u2014 ${issues.join(". ")}.` : `${tradeGradeLabel} \u2014 R:R is favorable, stop is in a safe zone, and leverage is reasonable.`;
  return { tradeGrade, tradeGradeLabel, tradeGradeExplanation };
}
function emptyOutputs() {
  return {
    liquidationPrice: 0,
    liquidationDistance: 0,
    hasLiquidation: false,
    effectiveImmune: true,
    minLeverageForLiquidation: null,
    liquidationPriceAtMinLeverage: null,
    liquidationDistanceAtMinLeverage: null,
    liquidationFallbackExplanation: null,
    hasInputError: false,
    inputErrorMessage: null,
    suggestedStopPrice: 0,
    effectiveStopPrice: 0,
    usedCustomStop: false,
    stopValidationMessage: null,
    lossAtStop: 0,
    lossAtStopPercent: 0,
    suggestedTargetPrice: 0,
    effectiveTargetPrice: 0,
    usedCustomTarget: false,
    targetValidationMessage: null,
    profitAtTarget: 0,
    profitAtTargetPercent: 0,
    rrRatio: 0,
    suggestedPositionSize: 0,
    suggestedLeverage: 0,
    tradeGrade: "yellow",
    tradeGradeLabel: "ENTER PARAMETERS",
    tradeGradeExplanation: "Fill in the form to see your risk analysis."
  };
}
function invalidInputOutputs(message) {
  return {
    liquidationPrice: 0,
    liquidationDistance: 0,
    hasLiquidation: false,
    effectiveImmune: true,
    minLeverageForLiquidation: null,
    liquidationPriceAtMinLeverage: null,
    liquidationDistanceAtMinLeverage: null,
    liquidationFallbackExplanation: null,
    hasInputError: true,
    inputErrorMessage: message,
    suggestedStopPrice: 0,
    effectiveStopPrice: 0,
    usedCustomStop: false,
    stopValidationMessage: null,
    lossAtStop: 0,
    lossAtStopPercent: 0,
    suggestedTargetPrice: 0,
    effectiveTargetPrice: 0,
    usedCustomTarget: false,
    targetValidationMessage: null,
    profitAtTarget: 0,
    profitAtTargetPercent: 0,
    rrRatio: 0,
    suggestedPositionSize: 0,
    suggestedLeverage: 0,
    tradeGrade: "red",
    tradeGradeLabel: "INVALID INPUT",
    tradeGradeExplanation: "Stop cannot equal entry price. Move the stop away from entry to calculate risk."
  };
}
function findMinimumLiquidationScenario(inputs) {
  for (let testLeverage = 1; testLeverage <= 100; testLeverage += 0.5) {
    const liquidationPrice = computeLiquidationPrice({
      ...inputs,
      leverage: testLeverage
    });
    const hasLiquidation = Number.isFinite(liquidationPrice) && liquidationPrice > 0;
    if (hasLiquidation) {
      const distancePct = Math.abs(liquidationPrice - inputs.entryPrice) / inputs.entryPrice * 100;
      return {
        leverage: testLeverage,
        price: liquidationPrice,
        distancePct,
        explanation: `Liquidation first appears around ${testLeverage.toFixed(1)}x, where the liquidation level would be ${liquidationPrice.toFixed(2)}.`
      };
    }
  }
  return null;
}
function computeLiquidationPrice(inputs) {
  const { direction, entryPrice, accountSize, positionSize, leverage } = inputs;
  const maintenanceMarginRate = 5e-3;
  const effectivePos = positionSize > 0 ? positionSize : accountSize * leverage;
  const marginUsed = effectivePos / leverage;
  const availableMargin = accountSize - marginUsed;
  const maintenanceMargin = effectivePos * maintenanceMarginRate;
  const marginBuffer = availableMargin - maintenanceMargin;
  let liquidationPrice;
  if (marginBuffer <= 0) {
    liquidationPrice = entryPrice;
  } else if (marginBuffer >= effectivePos) {
    liquidationPrice = direction === "long" ? 0 : Infinity;
  } else {
    liquidationPrice = direction === "long" ? entryPrice * (1 - marginBuffer / effectivePos) : entryPrice * (1 + marginBuffer / effectivePos);
  }
  return direction === "long" ? Math.max(0, liquidationPrice) : liquidationPrice;
}
function validateStop(direction, entryPrice, stopPrice) {
  if (stopPrice === null) return null;
  if (direction === "long" && stopPrice >= entryPrice) {
    return "Long stops must stay below entry, so auto stop is being used instead.";
  }
  if (direction === "short" && stopPrice <= entryPrice) {
    return "Short stops must stay above entry, so auto stop is being used instead.";
  }
  return null;
}
function validateTarget(direction, entryPrice, targetPrice) {
  if (targetPrice === null) return null;
  if (direction === "long" && targetPrice <= entryPrice) {
    return "Long targets must stay above entry, so auto target is being used instead.";
  }
  if (direction === "short" && targetPrice >= entryPrice) {
    return "Short targets must stay below entry, so auto target is being used instead.";
  }
  return null;
}

// src/signals/setup.ts
var DEFAULT_ACCOUNT_SIZE = 1e4;
function computeSuggestedSetup(coin, signals, currentPrice, options) {
  if (!isFinite(currentPrice) || currentPrice <= 0 || signals.isStale || signals.isWarmingUp || !isFinite(signals.volatility.atr) || signals.volatility.atr <= 0 || !isFinite(signals.entryGeometry.meanPrice)) {
    return null;
  }
  const decision = computeDecisionState({
    composite: signals.composite,
    entryGeometry: signals.entryGeometry,
    hurst: signals.hurst,
    isStale: signals.isStale,
    isWarmingUp: signals.isWarmingUp,
    riskStatus: "unknown"
  });
  if (decision.action !== "long" && decision.action !== "short") {
    return null;
  }
  const direction = decision.action;
  const atr = signals.volatility.atr;
  const riskOutputs = computeRisk(
    {
      coin,
      direction,
      entryPrice: currentPrice,
      accountSize: DEFAULT_ACCOUNT_SIZE,
      positionSize: 0,
      leverage: 1,
      stopPrice: null,
      targetPrice: null
    },
    atr
  );
  const alignmentRatio = signals.composite.agreementTotal > 0 ? signals.composite.agreementCount / signals.composite.agreementTotal : 0;
  const compositeStrength = Math.min(1, Math.abs(signals.composite.value));
  const reversionPotential = signals.entryGeometry.reversionPotential;
  const hurstConfidence = signals.hurst.confidence;
  const confidence = clamp2(
    alignmentRatio * compositeStrength * reversionPotential * hurstConfidence * 2,
    0,
    1
  );
  const confidenceTier = confidence > 0.6 ? "high" : confidence > 0.3 ? "medium" : "low";
  const timeframe = signals.entryGeometry.entryQuality === "ideal" && signals.hurst.regime === "mean-reverting" ? "4-24h" : signals.entryGeometry.entryQuality === "extended" ? "4-12h" : signals.entryGeometry.entryQuality === "early" ? "24-72h" : "4-24h";
  const stretch = Math.abs(signals.entryGeometry.stretchZEquivalent).toFixed(1);
  const mean = signals.entryGeometry.meanPrice;
  const agreementStr = `${signals.composite.agreementCount}/${signals.composite.agreementTotal}`;
  const summary = `${coin} is ${stretch}\u03C3 ${direction === "long" ? "below" : "above"} its 20-period mean ($${mean.toFixed(0)}) in a ${signals.hurst.regime} market. ${agreementStr} signals agree. ${direction.toUpperCase()} entry at $${currentPrice.toFixed(0)} with stop $${riskOutputs.suggestedStopPrice.toFixed(0)}, target $${riskOutputs.suggestedTargetPrice.toFixed(0)} (${riskOutputs.rrRatio.toFixed(1)}:1 R:R).`;
  return {
    coin,
    direction,
    entryPrice: currentPrice,
    stopPrice: riskOutputs.suggestedStopPrice,
    targetPrice: riskOutputs.suggestedTargetPrice,
    meanReversionTarget: mean,
    rrRatio: riskOutputs.rrRatio,
    suggestedPositionSize: riskOutputs.suggestedPositionSize,
    suggestedLeverage: riskOutputs.suggestedLeverage,
    tradeGrade: riskOutputs.tradeGrade,
    confidence,
    confidenceTier,
    entryQuality: signals.entryGeometry.entryQuality,
    agreementCount: signals.composite.agreementCount,
    agreementTotal: signals.composite.agreementTotal,
    regime: signals.hurst.regime,
    reversionPotential,
    stretchSigma: Math.abs(signals.entryGeometry.stretchZEquivalent),
    atr,
    compositeValue: signals.composite.value,
    timeframe,
    summary,
    generatedAt: options?.generatedAt ?? Date.now(),
    source: options?.source
  };
}
function clamp2(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
export {
  TRACKED_COINS,
  computeATR,
  computeComposite,
  computeEntryGeometry,
  computeFundingZScore,
  computeHurst,
  computeOIDelta,
  computeRealizedVol,
  computeSuggestedSetup,
  computeZScore,
  parseCandle
};

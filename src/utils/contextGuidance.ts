import type { ContextTone, CryptoMacroSnapshot } from '../types/context'

interface ContextClassification {
  label: string
  tone: ContextTone
  explanation: string
}

export function classifyFearGreed(value: number | null): ContextClassification {
  if (value === null) {
    return { label: 'Unknown', tone: 'yellow', explanation: 'Fear & Greed data unavailable.' }
  }
  if (value <= 20) {
    return {
      label: 'Extreme Fear',
      tone: 'green',
      explanation: 'Market is in extreme fear. Historically a contrarian buying signal — crowds are panic-selling.',
    }
  }
  if (value <= 40) {
    return {
      label: 'Fear',
      tone: 'green',
      explanation: 'Market sentiment is fearful. Often precedes recoveries, but can persist in true downtrends.',
    }
  }
  if (value <= 60) {
    return {
      label: 'Neutral',
      tone: 'yellow',
      explanation: 'Sentiment is balanced. No strong crowd bias in either direction.',
    }
  }
  if (value <= 80) {
    return {
      label: 'Greed',
      tone: 'yellow',
      explanation: 'Market is greedy. Caution warranted — late longs tend to get trapped here.',
    }
  }
  return {
    label: 'Extreme Greed',
    tone: 'red',
    explanation: 'Market is euphoric. Historically a contrarian sell signal — crowds are over-leveraged.',
  }
}

export function classifyBtcDominance(
  value: number | null,
  altBias: CryptoMacroSnapshot['altSeasonBias'],
): ContextClassification {
  if (value === null) {
    return { label: 'Unknown', tone: 'yellow', explanation: 'BTC dominance data unavailable.' }
  }

  const pct = value.toFixed(1) + '%'

  if (altBias === 'btc-headwind') {
    return {
      label: `${pct} (BTC headwind)`,
      tone: 'red',
      explanation: `BTC dominance is high at ${pct}. Capital is concentrating in BTC — alts face headwinds.`,
    }
  }

  if (altBias === 'alt-tailwind') {
    return {
      label: `${pct} (Alt tailwind)`,
      tone: 'green',
      explanation: `BTC dominance is lower at ${pct} with positive market growth. Capital is flowing into alts.`,
    }
  }

  return {
    label: `${pct}`,
    tone: 'yellow',
    explanation: `BTC dominance is ${pct}. No strong rotation signal in either direction.`,
  }
}

export function classifyFundingDivergence(value: number | null): ContextClassification {
  if (value === null) {
    return { label: 'N/A', tone: 'yellow', explanation: 'Cross-exchange funding comparison unavailable.' }
  }

  const bps = (value * 10000).toFixed(1)
  const abs = Math.abs(value)

  if (abs < 0.0001) {
    return {
      label: 'Aligned',
      tone: 'yellow',
      explanation: `Funding rates are aligned across exchanges (${bps} bps difference). No arbitrage pressure.`,
    }
  }

  if (value > 0) {
    return {
      label: `Binance higher (+${bps} bps)`,
      tone: abs > 0.0005 ? 'red' : 'yellow',
      explanation: `Binance funding is higher than Hyperliquid by ${bps} bps. Longs are more crowded on Binance.`,
    }
  }

  return {
    label: `HL higher (${bps} bps)`,
    tone: abs > 0.0005 ? 'red' : 'yellow',
    explanation: `Hyperliquid funding is higher than Binance by ${Math.abs(parseFloat(bps))} bps. Longs are more crowded on Hyperliquid.`,
  }
}

export function classifyOiDivergence(value: number | null): ContextClassification {
  if (value === null) {
    return { label: 'N/A', tone: 'yellow', explanation: 'Cross-exchange OI comparison unavailable.' }
  }

  const millions = (value / 1e6).toFixed(0)
  const abs = Math.abs(value)

  if (abs < 50e6) {
    return {
      label: 'Similar',
      tone: 'yellow',
      explanation: 'Open interest levels are comparable across exchanges. No major positioning divergence.',
    }
  }

  if (value > 0) {
    return {
      label: `Binance +$${millions}M`,
      tone: 'yellow',
      explanation: `Binance has $${millions}M more open interest. More leveraged positioning on Binance.`,
    }
  }

  return {
    label: `HL +$${Math.abs(parseInt(millions))}M`,
    tone: 'yellow',
    explanation: `Hyperliquid has $${Math.abs(parseInt(millions))}M more open interest relative to Binance.`,
  }
}

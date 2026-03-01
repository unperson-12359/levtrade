import type { EntryGeometryResult, EntryQuality, SignalColor } from '../types/signals'

export function computeEntryGeometry(closes: number[], atr: number, period: number = 20): EntryGeometryResult {
  if (closes.length < period) {
    return {
      distanceFromMeanPct: 0,
      stretchZEquivalent: 0,
      atrDislocation: 0,
      bandPosition: 0.5,
      reversionPotential: 0,
      chaseRisk: 0.25,
      entryQuality: 'no-edge',
      directionBias: 'neutral',
      color: 'yellow',
      explanation: `Need at least ${period} closes to score entry geometry. Currently have ${closes.length}.`,
    }
  }

  const window = closes.slice(-period)
  const current = window[window.length - 1]!
  const mean = window.reduce((sum, value) => sum + value, 0) / window.length
  const variance = window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / window.length
  const stddev = Math.sqrt(variance)

  if (stddev === 0 || mean <= 0) {
    return {
      distanceFromMeanPct: 0,
      stretchZEquivalent: 0,
      atrDislocation: 0,
      bandPosition: 0.5,
      reversionPotential: 0,
      chaseRisk: 0.2,
      entryQuality: 'no-edge',
      directionBias: 'neutral',
      color: 'yellow',
      explanation: 'Price is too flat to score a meaningful entry edge.',
    }
  }

  const z = (current - mean) / stddev
  const distanceFromMeanPct = ((current - mean) / mean) * 100
  const atrDislocation = atr > 0 ? Math.abs(current - mean) / atr : 0
  const bandPosition = clamp((z + 2.5) / 5, 0, 1)
  const directionBias = z < -0.35 ? 'long' : z > 0.35 ? 'short' : 'neutral'
  const absZ = Math.abs(z)

  const reversionPotential = clamp((absZ - 0.6) / 1.8, 0, 1)
  const chaseRisk = clamp((2.8 - absZ) / 2.8, 0, 1)
  const entryQuality = classifyEntryQuality(absZ, atrDislocation)
  const color = entryColor(entryQuality)
  const explanation = buildExplanation(current, mean, z, atrDislocation, entryQuality)

  return {
    distanceFromMeanPct,
    stretchZEquivalent: z,
    atrDislocation,
    bandPosition,
    reversionPotential,
    chaseRisk,
    entryQuality,
    directionBias,
    color,
    explanation,
  }
}

function classifyEntryQuality(absZ: number, atrDislocation: number): EntryQuality {
  if (absZ < 0.75) return 'no-edge'
  if (absZ < 1.25 || atrDislocation < 0.8) return 'early'
  if (absZ <= 2.4 && atrDislocation <= 2.4) return 'ideal'
  if (absZ <= 3.2 && atrDislocation <= 3.4) return 'extended'
  return 'chasing'
}

function entryColor(entryQuality: EntryQuality): SignalColor {
  switch (entryQuality) {
    case 'ideal':
      return 'green'
    case 'extended':
    case 'early':
      return 'yellow'
    case 'chasing':
    case 'no-edge':
      return 'red'
  }
}

function buildExplanation(
  current: number,
  mean: number,
  z: number,
  atrDislocation: number,
  entryQuality: EntryQuality,
): string {
  const side = z > 0 ? 'above' : 'below'
  const direction = z > 0 ? 'short' : 'long'

  switch (entryQuality) {
    case 'ideal':
      return `Price is ${Math.abs(z).toFixed(2)} standard deviations ${side} fair value with ${atrDislocation.toFixed(2)} ATRs of stretch. This is the sweet spot for a ${direction} fade.`
    case 'extended':
      return `Price is deeply stretched (${Math.abs(z).toFixed(2)}σ, ${atrDislocation.toFixed(2)} ATRs). The setup is still actionable, but slippage and violent snap-backs are more likely.`
    case 'early':
      return `Price is leaning away from fair value but has not stretched enough yet (${Math.abs(z).toFixed(2)}σ, ${atrDislocation.toFixed(2)} ATRs). Let it travel further before leaning in.`
    case 'chasing':
      return `Price is too far from equilibrium (${Math.abs(z).toFixed(2)}σ). The move is likely already overextended, so chasing here carries poor geometry.`
    case 'no-edge':
      return `Price (${current.toFixed(2)}) is still hugging its mean (${mean.toFixed(2)}). The rubber band has not stretched enough to create a clean mean-reversion edge.`
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

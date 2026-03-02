import type { TrackedCoin } from '../types/market'
import type { HurstResult, VolatilityResult, CompositeSignal, OverallStatus } from '../types/signals'
import type { RiskOutputs } from '../types/risk'

export function regimeVerdict(coin: TrackedCoin, hurst: HurstResult, vol: VolatilityResult): string {
  const regimeWord = hurst.regime === 'mean-reverting'
    ? 'bouncing between levels'
    : hurst.regime === 'trending'
      ? 'trending in one direction'
      : 'moving without a clear pattern'

  const volWord = vol.level === 'low'
    ? 'calm'
    : vol.level === 'normal'
      ? 'normal'
      : vol.level === 'high'
        ? 'volatile'
        : 'extremely volatile'

  const actionWord = hurst.regime === 'mean-reverting'
    ? 'good conditions for our signals'
    : hurst.regime === 'trending'
      ? 'our mean-reversion signals won\'t work well here, sit this one out'
      : 'signals are unreliable, wait for clarity'

  return `${coin} is ${regimeWord} with ${volWord} volatility — ${actionWord}.`
}

export function overallStatus(hurst: HurstResult, composite: CompositeSignal): OverallStatus {
  // If regime is choppy or trending → CAUTION at best
  if (hurst.regime === 'choppy') return 'AVOID'
  if (hurst.regime === 'trending') return 'AVOID'

  // If signals are strong and aligned
  if (composite.strength === 'strong' && composite.agreementCount >= 3) return 'FAVORABLE'
  if (composite.strength === 'moderate' && composite.agreementCount >= 2) return 'CAUTION'

  if (composite.direction === 'neutral') return 'AVOID'

  return 'CAUTION'
}

export function overallStatusColor(status: OverallStatus): 'green' | 'yellow' | 'red' {
  switch (status) {
    case 'FAVORABLE': return 'green'
    case 'CAUTION': return 'yellow'
    case 'AVOID': return 'red'
  }
}

export function riskVerdict(risk: RiskOutputs): string {
  return risk.tradeGradeExplanation
}

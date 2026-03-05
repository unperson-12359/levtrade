import { emptyOutcome } from './_signals.mjs'
import type { BacktestWindowStatsV1 } from '../src/contracts/v1'
import type { SetupOutcome, SetupWindow, SuggestedSetup } from '../src/types/setup'

export interface CanonicalSetupRow {
  id: string
  setup_json: SuggestedSetup
  outcomes_json: Record<string, unknown> | null
  generated_at: string
  updated_at: string | null
}

export interface NormalizedCanonicalSetup {
  id: string
  setup: SuggestedSetup
  outcomes: Record<SetupWindow, SetupOutcome>
  generatedAtMs: number
  updatedAtMs: number
}

export function normalizeCanonicalSetups(rows: CanonicalSetupRow[]): NormalizedCanonicalSetup[] {
  return rows.map((row) => ({
    id: row.id,
    setup: row.setup_json,
    outcomes: {
      '4h': normalizeOutcome(row.outcomes_json?.['4h'], '4h'),
      '24h': normalizeOutcome(row.outcomes_json?.['24h'], '24h'),
      '72h': normalizeOutcome(row.outcomes_json?.['72h'], '72h'),
    },
    generatedAtMs: Date.parse(row.generated_at),
    updatedAtMs: Date.parse(row.updated_at ?? row.generated_at),
  }))
}

export function summarizeWindowStats(
  setups: NormalizedCanonicalSetup[],
  window: SetupWindow,
): BacktestWindowStatsV1 {
  let wins = 0
  let losses = 0
  let expired = 0
  let unresolvable = 0
  let pending = 0
  let resolvedCount = 0
  let rTotal = 0

  for (const tracked of setups) {
    const outcome = tracked.outcomes[window]
    if (outcome.result === 'win') wins += 1
    else if (outcome.result === 'loss') losses += 1
    else if (outcome.result === 'expired') expired += 1
    else if (outcome.result === 'unresolvable') unresolvable += 1
    else pending += 1

    if (outcome.result !== 'pending' && outcome.result !== 'unresolvable') {
      resolvedCount += 1
      if (typeof outcome.rAchieved === 'number') {
        rTotal += outcome.rAchieved
      }
    }
  }

  const directional = wins + losses
  return {
    sampleSize: setups.length,
    wins,
    losses,
    expired,
    unresolvable,
    pending,
    winRate: directional > 0 ? wins / directional : null,
    avgR: resolvedCount > 0 ? rTotal / resolvedCount : null,
  }
}

function normalizeOutcome(raw: unknown, window: SetupWindow): SetupOutcome {
  return {
    ...emptyOutcome(window),
    ...(typeof raw === 'object' && raw !== null ? raw : {}),
    window,
  } as SetupOutcome
}

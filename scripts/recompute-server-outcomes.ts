import { resolveSetupWindow } from '../src/signals/resolveOutcome'
import type { SetupOutcome, SetupWindow, SuggestedSetup } from '../src/types/setup'
import type { Candle } from '../src/types/market'
import { fetchCandles } from '../src/services/api'
import { parseCandle } from '../src/types/market'

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const WINDOWS: SetupWindow[] = ['4h', '24h', '72h']

interface ServerSetupRow {
  id: string
  coin: string
  setup_json: SuggestedSetup
  outcomes_json: Record<SetupWindow, SetupOutcome> | null
}

async function main(): Promise<void> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }

  const rows = await fetchServerSetups()
  let updatedRows = 0
  let changedOutcomes = 0

  for (const row of rows) {
    const now = Date.now()
    const candles = await fetchResolutionCandles(row.setup_json)
    const currentOutcomes = row.outcomes_json ?? emptyOutcomes()
    const nextOutcomes = { ...currentOutcomes }
    let rowChanged = false

    for (const window of WINDOWS) {
      const next = resolveSetupWindow(row.setup_json, window, candles, now)
      if (!next) {
        continue
      }

      const previous = currentOutcomes[window]
      if (JSON.stringify(previous) !== JSON.stringify(next)) {
        nextOutcomes[window] = next
        changedOutcomes += 1
        rowChanged = true
      }
    }

    if (rowChanged) {
      await updateSetupOutcomes(row.id, nextOutcomes, now)
      updatedRows += 1
    }
  }

  console.log(`Reviewed ${rows.length} server setups`)
  console.log(`Updated ${updatedRows} rows and ${changedOutcomes} outcome windows`)
}

async function fetchServerSetups(): Promise<ServerSetupRow[]> {
  const params = new URLSearchParams({
    scope: 'eq.global',
    order: 'generated_at.desc',
    limit: '2000',
    select: 'id,coin,setup_json,outcomes_json',
  })

  const response = await fetch(`${restBaseUrl()}/server_setups?${params.toString()}`, {
    headers: supabaseHeaders(),
  })
  if (!response.ok) {
    throw new Error(`Failed to load server setups: ${response.status}`)
  }

  return response.json() as Promise<ServerSetupRow[]>
}

async function fetchResolutionCandles(setup: SuggestedSetup): Promise<Candle[]> {
  const now = Date.now()
  const startTime = setup.generatedAt - (6 * 60 * 60 * 1000)
  const rawCandles = await fetchCandles(setup.coin, '1h', startTime, now)
  return rawCandles.map(parseCandle)
}

async function updateSetupOutcomes(
  setupId: string,
  outcomes: Record<SetupWindow, SetupOutcome>,
  now: number,
): Promise<void> {
  const response = await fetch(`${restBaseUrl()}/server_setups?id=eq.${setupId}`, {
    method: 'PATCH',
    headers: { ...supabaseHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({
      outcomes_json: outcomes,
      updated_at: new Date(now).toISOString(),
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to update setup ${setupId}: ${response.status}`)
  }
}

function emptyOutcomes(): Record<SetupWindow, SetupOutcome> {
  return {
    '4h': emptyOutcome('4h'),
    '24h': emptyOutcome('24h'),
    '72h': emptyOutcome('72h'),
  }
}

function emptyOutcome(window: SetupWindow): SetupOutcome {
  return {
    window,
    resolvedAt: null,
    result: 'pending',
    resolutionReason: 'pending',
    coverageStatus: 'full',
    candleCountUsed: 0,
    returnPct: null,
    rAchieved: null,
    mfe: null,
    mfePct: null,
    mae: null,
    maePct: null,
    targetHit: false,
    stopHit: false,
    priceAtResolution: null,
  }
}

function restBaseUrl(): string {
  return `${env.SUPABASE_URL!}/rest/v1`
}

function supabaseHeaders(): Record<string, string> {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY!}`,
    'Content-Type': 'application/json',
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})

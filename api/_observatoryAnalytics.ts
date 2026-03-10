import type { IndicatorCategory } from '../src/observatory/types'
import {
  buildPersistedObservatoryAnalytics,
  type PersistedObservatoryAnalytics,
} from '../src/observatory/analytics'
import type { TrackedCoin } from './_signals.mjs'
import type { ObservatoryInterval } from './_hyperliquid.js'

const DAY_MS = 24 * 60 * 60 * 1000
const READ_BATCH_SIZE = 10_000

interface LedgerRow {
  candle_time: string
  indicator_id: string
  category: IndicatorCategory
  is_on: boolean
}

export async function loadPersistedObservatoryAnalytics(input: {
  coin: TrackedCoin
  interval: ObservatoryInterval
  days: number
}): Promise<PersistedObservatoryAnalytics> {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  }

  const startIso = new Date(Date.now() - input.days * DAY_MS).toISOString()
  const rows = await fetchAllLedgerRows({
    url,
    serviceRoleKey,
    coin: input.coin,
    interval: input.interval,
    startIso,
  })

  return buildPersistedObservatoryAnalytics({
    coin: input.coin,
    interval: input.interval,
    days: input.days,
    rows: rows
      .map((row) => ({
        candleTime: Date.parse(row.candle_time),
        indicatorId: row.indicator_id,
        category: row.category,
        isOn: row.is_on,
      }))
      .filter((row) => Number.isFinite(row.candleTime)),
  })
}

async function fetchAllLedgerRows(input: {
  url: string
  serviceRoleKey: string
  coin: TrackedCoin
  interval: ObservatoryInterval
  startIso: string
}): Promise<LedgerRow[]> {
  const rows: LedgerRow[] = []
  let from = 0

  while (true) {
    const params = new URLSearchParams()
    params.set('select', 'candle_time,indicator_id,category,is_on')
    params.set('coin', `eq.${input.coin}`)
    params.set('interval', `eq.${input.interval}`)
    params.set('candle_time', `gte.${input.startIso}`)
    params.set('order', 'candle_time.asc,indicator_id.asc')

    const response = await fetch(
      `${input.url.replace(/\/$/, '')}/rest/v1/observatory_indicator_states?${params.toString()}`,
      {
        headers: {
          apikey: input.serviceRoleKey,
          Authorization: `Bearer ${input.serviceRoleKey}`,
          Range: `${from}-${from + READ_BATCH_SIZE - 1}`,
          'Range-Unit': 'items',
        },
      },
    )

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Supabase analytics read failed: ${response.status} ${body}`)
    }

    const page = (await response.json()) as LedgerRow[]
    rows.push(...page)

    if (page.length < READ_BATCH_SIZE) {
      break
    }
    from += READ_BATCH_SIZE
  }

  return rows
}

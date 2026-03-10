import {
  OBSERVATORY_RULESET_VERSION,
  buildClosedIndicatorStateRecords,
  buildObservatorySnapshot,
  parseCandle,
  type TrackedCoin,
} from './_signals.mjs'
import { fetchCandles, type ObservatoryInterval } from './_hyperliquid.js'
import type { IndicatorStateRecord } from '../src/observatory/types'

const DAY_MS = 24 * 60 * 60 * 1000
const WARMUP_BARS = 220
const UPSERT_BATCH_SIZE = 500

export const CRON_PERSISTENCE_DAYS: Record<ObservatoryInterval, number> = {
  '4h': 14,
  '1d': 14,
}

interface PersistOptions {
  coin: TrackedCoin
  interval: ObservatoryInterval
  startTime: number
  endTime?: number
}

interface PersistedStateRow {
  id: string
  coin: TrackedCoin
  interval: ObservatoryInterval
  candle_time: string
  indicator_id: string
  category: IndicatorStateRecord['category']
  rule_version: string
  is_on: boolean
}

export interface PersistenceRunResult {
  rulesetVersion: string
  coin: TrackedCoin
  interval: ObservatoryInterval
  startTime: number
  endTime: number
  candleCount: number
  closedBarCount: number
  rowCount: number
  upsertedRows: number
}

export async function persistObservatoryStates(options: PersistOptions): Promise<PersistenceRunResult> {
  const endTime = options.endTime ?? Date.now()
  const intervalMs = intervalToMs(options.interval)
  const fetchStart = Math.max(0, options.startTime - (WARMUP_BARS * intervalMs))

  const rawCandles = await fetchCandles(options.coin, options.interval, fetchStart, endTime)
  const candles = rawCandles.map(parseCandle).sort((left, right) => left.time - right.time)

  const snapshot = buildObservatorySnapshot({
    coin: options.coin,
    interval: options.interval,
    candles,
  })

  const closedRecords = buildClosedIndicatorStateRecords(snapshot, { now: endTime })
  const filteredRecords = closedRecords.filter(
    (record) => record.candleTime >= options.startTime && record.candleTime <= endTime,
  )
  const rows = filteredRecords.map(toPersistenceRow)

  if (rows.length > 0) {
    await upsertRows(rows)
  }

  return {
    rulesetVersion: OBSERVATORY_RULESET_VERSION,
    coin: options.coin,
    interval: options.interval,
    startTime: options.startTime,
    endTime,
    candleCount: candles.length,
    closedBarCount: countDistinctBarTimes(filteredRecords),
    rowCount: filteredRecords.length,
    upsertedRows: rows.length,
  }
}

export async function persistObservatoryLookback(options: {
  coin: TrackedCoin
  interval: ObservatoryInterval
  days: number
  endTime?: number
}): Promise<PersistenceRunResult> {
  const endTime = options.endTime ?? Date.now()
  return persistObservatoryStates({
    coin: options.coin,
    interval: options.interval,
    startTime: endTime - (options.days * DAY_MS),
    endTime,
  })
}

export function authorizePersistenceRequest(input: {
  authorizationHeader?: string | string[]
  headerSecret?: string | string[]
}): { ok: true } | { ok: false; reason: string } {
  const expected = process.env.OBSERVATORY_PERSIST_SECRET ?? process.env.CRON_SECRET
  if (!expected) {
    return { ok: false, reason: 'Missing OBSERVATORY_PERSIST_SECRET or CRON_SECRET.' }
  }

  const authorizationHeader = firstValue(input.authorizationHeader)
  const headerSecret = firstValue(input.headerSecret)
  const bearer = authorizationHeader?.startsWith('Bearer ')
    ? authorizationHeader.slice('Bearer '.length).trim()
    : null

  if (bearer === expected || headerSecret === expected) {
    return { ok: true }
  }

  return { ok: false, reason: 'Unauthorized persistence request.' }
}

function countDistinctBarTimes(records: IndicatorStateRecord[]): number {
  return new Set(records.map((record) => record.candleTime)).size
}

function toPersistenceRow(record: IndicatorStateRecord): PersistedStateRow {
  if (record.interval === '1h') {
    throw new Error('1h persistence is not supported by the current observatory ledger.')
  }

  return {
    id: record.id,
    coin: record.coin,
    interval: record.interval,
    candle_time: new Date(record.candleTime).toISOString(),
    indicator_id: record.indicatorId,
    category: record.category,
    rule_version: OBSERVATORY_RULESET_VERSION,
    is_on: record.isOn,
  }
}

async function upsertRows(rows: PersistedStateRow[]): Promise<void> {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  }

  for (const chunk of chunkRows(rows, UPSERT_BATCH_SIZE)) {
    const response = await fetch(
      `${url.replace(/\/$/, '')}/rest/v1/observatory_indicator_states?on_conflict=id`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(chunk),
      },
    )

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Supabase upsert failed: ${response.status} ${body}`)
    }
  }
}

function chunkRows(rows: PersistedStateRow[], size: number): PersistedStateRow[][] {
  const chunks: PersistedStateRow[][] = []
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size))
  }
  return chunks
}

function intervalToMs(interval: ObservatoryInterval): number {
  return interval === '4h' ? 4 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
}

function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

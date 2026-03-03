import { buildSetupId, emptyOutcome } from './_signals.mjs'
import type { SuggestedSetup } from '../src/types/setup'

interface VercelRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

interface IncomingSetup {
  id: unknown
  setup: unknown
  outcomes?: unknown
  syncEligible?: unknown
}

interface ValidatedIncomingSetup {
  id: string
  setup: SuggestedSetup
}

interface ExistingServerSetupRow {
  id: string
  setup_json: Pick<SuggestedSetup, 'coin' | 'direction' | 'generatedAt' | 'entryPrice' | 'stopPrice' | 'targetPrice'>
}

const GLOBAL_SCOPE = 'global'
const MAX_BATCH_SIZE = 100
const MAX_ID_LENGTH = 200
const MAX_SUMMARY_LENGTH = 1_000
const MAX_SETUP_AGE_MS = 90 * 24 * 60 * 60 * 1000
const MAX_FUTURE_SKEW_MS = 10 * 60 * 1000
const PAGE_SIZE = 1000

const ALLOWED_COINS = new Set(['BTC', 'ETH', 'SOL', 'HYPE'])
const ALLOWED_DIRECTIONS = new Set(['long', 'short'])
const ALLOWED_SIGNAL_COLORS = new Set(['green', 'yellow', 'red'])
const ALLOWED_CONFIDENCE_TIERS = new Set(['high', 'medium', 'low'])
const ALLOWED_ENTRY_QUALITIES = new Set(['ideal', 'early', 'extended', 'chasing', 'no-edge'])
const ALLOWED_REGIMES = new Set(['trending', 'mean-reverting', 'choppy'])
const ALLOWED_TIMEFRAMES = new Set(['4-12h', '4-24h', '24-72h', 'wait'])
const ALLOWED_SOURCES = new Set(['live', 'backfill'])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const contentType = getSingleHeader(req.headers, 'content-type')
  if (!contentType?.toLowerCase().includes('application/json')) {
    return res.status(415).json({ ok: false, error: 'Expected application/json body' })
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SETUP_UPLOAD_SECRET) {
    return res.status(503).json({ ok: false, error: 'Not configured', disabled: true })
  }

  const uploadSecret = getSingleHeader(req.headers, 'x-levtrade-upload-secret')
  if (!uploadSecret || uploadSecret !== process.env.SETUP_UPLOAD_SECRET) {
    return res.status(401).json({ ok: false, error: 'Unauthorized', disabled: false, reason: 'unauthorized' })
  }

  try {
    const body = req.body as { setups?: IncomingSetup[] } | undefined
    const setups = body?.setups

    if (!Array.isArray(setups) || setups.length === 0) {
      return res.status(400).json({ ok: false, error: 'No setups provided', rejected: 0, disabled: false })
    }

    if (setups.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        ok: false,
        error: `Max ${MAX_BATCH_SIZE} setups per request`,
        rejected: setups.length,
        disabled: false,
      })
    }

    const validated: ValidatedIncomingSetup[] = []
    let rejected = 0

    for (const item of setups) {
      if (item.syncEligible === false) {
        rejected += 1
        continue
      }

      const normalized = validateIncomingSetup(item)
      if (normalized) {
        validated.push(normalized)
      } else {
        rejected += 1
      }
    }

    if (validated.length === 0) {
      return res.status(400).json({ ok: false, error: 'No valid setups in payload', rejected, disabled: false })
    }

    const existing = await fetchExistingServerSetupKeys(validated)
    const rowsToInsert = validated.filter(
      (item) => !existing.ids.has(item.id) && !existing.keys.has(buildSetupId(item.setup)),
    )

    if (rowsToInsert.length === 0) {
      return res.status(200).json({
        ok: true,
        synced: 0,
        skipped: validated.length,
        rejected,
        total: setups.length,
        disabled: false,
      })
    }

    const rows = rowsToInsert.map((item) => ({
      id: item.id,
      scope: GLOBAL_SCOPE,
      coin: item.setup.coin,
      direction: item.setup.direction,
      setup_json: item.setup,
      outcomes_json: {
        '4h': emptyOutcome('4h'),
        '24h': emptyOutcome('24h'),
        '72h': emptyOutcome('72h'),
      },
      generated_at: new Date(item.setup.generatedAt).toISOString(),
      updated_at: new Date().toISOString(),
    }))

    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/server_setups`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=representation',
      },
      body: JSON.stringify(rows),
    })

    if (!response.ok) {
      const text = await response.text()
      return res.status(500).json({
        ok: false,
        error: `Supabase insert failed: ${response.status}`,
        detail: text,
        rejected,
        disabled: false,
      })
    }

    const inserted = (await response.json()) as unknown[]
    const synced = inserted.length
    const skipped = validated.length - synced

    return res.status(200).json({
      ok: true,
      synced,
      skipped,
      rejected,
      total: setups.length,
      disabled: false,
    })
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Unexpected error',
      disabled: false,
    })
  }
}

function getSingleHeader(headers: Record<string, string | string[] | undefined>, name: string): string | null {
  const value = headers[name] ?? headers[name.toLowerCase()]
  if (Array.isArray(value)) {
    return value[0] ?? null
  }
  return typeof value === 'string' ? value : null
}

function validateIncomingSetup(input: IncomingSetup): ValidatedIncomingSetup | null {
  if (!input || typeof input !== 'object') return null
  if (typeof input.id !== 'string' || input.id.trim().length === 0 || input.id.length > MAX_ID_LENGTH) return null
  if (!input.setup || typeof input.setup !== 'object') return null

  const setup = input.setup as Record<string, unknown>
  const now = Date.now()

  const coin = stringFromAllowedSet(setup.coin, ALLOWED_COINS)
  const direction = stringFromAllowedSet(setup.direction, ALLOWED_DIRECTIONS)
  const tradeGrade = stringFromAllowedSet(setup.tradeGrade, ALLOWED_SIGNAL_COLORS)
  const confidenceTier = stringFromAllowedSet(setup.confidenceTier, ALLOWED_CONFIDENCE_TIERS)
  const entryQuality = stringFromAllowedSet(setup.entryQuality, ALLOWED_ENTRY_QUALITIES)
  const regime = stringFromAllowedSet(setup.regime, ALLOWED_REGIMES)
  const timeframe = stringFromAllowedSet(setup.timeframe, ALLOWED_TIMEFRAMES)

  const entryPrice = positiveFiniteNumber(setup.entryPrice)
  const stopPrice = positiveFiniteNumber(setup.stopPrice)
  const targetPrice = positiveFiniteNumber(setup.targetPrice)
  const meanReversionTarget = positiveFiniteNumber(setup.meanReversionTarget)
  const rrRatio = positiveFiniteNumber(setup.rrRatio)
  const suggestedPositionSize = nonNegativeFiniteNumber(setup.suggestedPositionSize)
  const suggestedLeverage = positiveFiniteNumber(setup.suggestedLeverage)
  const confidence = boundedFiniteNumber(setup.confidence, 0, 1)
  const agreementCount = nonNegativeInteger(setup.agreementCount)
  const agreementTotal = nonNegativeInteger(setup.agreementTotal)
  const reversionPotential = nonNegativeFiniteNumber(setup.reversionPotential)
  const stretchSigma = nonNegativeFiniteNumber(setup.stretchSigma)
  const atr = positiveFiniteNumber(setup.atr)
  const compositeValue = finiteNumber(setup.compositeValue)
  const generatedAt = positiveInteger(setup.generatedAt)
  const summary = typeof setup.summary === 'string' && setup.summary.length > 0 && setup.summary.length <= MAX_SUMMARY_LENGTH
    ? setup.summary
    : null

  if (
    !coin ||
    !direction ||
    !tradeGrade ||
    !confidenceTier ||
    !entryQuality ||
    !regime ||
    !timeframe ||
    entryPrice === null ||
    stopPrice === null ||
    targetPrice === null ||
    meanReversionTarget === null ||
    rrRatio === null ||
    suggestedPositionSize === null ||
    suggestedLeverage === null ||
    confidence === null ||
    agreementCount === null ||
    agreementTotal === null ||
    reversionPotential === null ||
    stretchSigma === null ||
    atr === null ||
    compositeValue === null ||
    generatedAt === null ||
    !summary
  ) {
    return null
  }

  if (stopPrice === entryPrice || targetPrice === entryPrice) return null
  if (generatedAt < now - MAX_SETUP_AGE_MS || generatedAt > now + MAX_FUTURE_SKEW_MS) return null

  const source =
    setup.source === undefined
      ? undefined
      : stringFromAllowedSet(setup.source, ALLOWED_SOURCES)
  if (setup.source !== undefined && !source) return null

  return {
    id: input.id.trim(),
    setup: {
      coin,
      direction,
      entryPrice,
      stopPrice,
      targetPrice,
      meanReversionTarget,
      rrRatio,
      suggestedPositionSize,
      suggestedLeverage,
      tradeGrade,
      confidence,
      confidenceTier,
      entryQuality,
      agreementCount,
      agreementTotal,
      regime,
      reversionPotential,
      stretchSigma,
      atr,
      compositeValue,
      timeframe,
      summary,
      generatedAt,
      source,
    },
  }
}

async function fetchExistingServerSetupKeys(setups: ValidatedIncomingSetup[]): Promise<{
  ids: Set<string>
  keys: Set<string>
}> {
  if (setups.length === 0) {
    return { ids: new Set(), keys: new Set() }
  }

  const coins = [...new Set(setups.map((item) => item.setup.coin))]
  const oldestGeneratedAt = Math.min(...setups.map((item) => item.setup.generatedAt))
  const newestGeneratedAt = Math.max(...setups.map((item) => item.setup.generatedAt))

  const ids = new Set<string>()
  const keys = new Set<string>()
  let offset = 0

  while (true) {
    const params = new URLSearchParams()
    params.set('select', 'id,setup_json')
    params.set('scope', `eq.${GLOBAL_SCOPE}`)
    params.set('coin', `in.(${coins.join(',')})`)
    params.set(
      'and',
      `(generated_at.gte.${new Date(oldestGeneratedAt).toISOString()},generated_at.lte.${new Date(newestGeneratedAt).toISOString()})`,
    )
    params.set('order', 'generated_at.asc')
    params.set('limit', String(PAGE_SIZE))
    params.set('offset', String(offset))

    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/server_setups?${params.toString()}`, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Supabase lookup failed: ${response.status}`)
    }

    const rows = (await response.json()) as ExistingServerSetupRow[]
    for (const row of rows) {
      ids.add(row.id)
      keys.add(buildSetupId(row.setup_json))
    }

    if (rows.length < PAGE_SIZE) {
      break
    }

    offset += PAGE_SIZE
  }

  return { ids, keys }
}

function stringFromAllowedSet(value: unknown, allowed: Set<string>): string | null {
  return typeof value === 'string' && allowed.has(value) ? value : null
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && isFinite(value) ? value : null
}

function positiveFiniteNumber(value: unknown): number | null {
  const normalized = finiteNumber(value)
  return normalized !== null && normalized > 0 ? normalized : null
}

function nonNegativeFiniteNumber(value: unknown): number | null {
  const normalized = finiteNumber(value)
  return normalized !== null && normalized >= 0 ? normalized : null
}

function boundedFiniteNumber(value: unknown, min: number, max: number): number | null {
  const normalized = finiteNumber(value)
  return normalized !== null && normalized >= min && normalized <= max ? normalized : null
}

function positiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

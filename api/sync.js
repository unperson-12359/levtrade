const SCOPE = 'global'
const SCHEMA_VERSION = 1

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return sendJson(res, 405, { ok: false, error: 'Method not allowed.' })
  }

  const envError = validateEnv()
  if (envError) {
    return sendJson(res, 503, { ok: false, error: envError })
  }

  const secret = req.headers['x-levtrade-sync-secret']
  if (!secret || secret !== process.env.SYNC_SHARED_SECRET) {
    return sendJson(res, 401, { ok: false, error: 'Invalid sync secret.' })
  }

  try {
    if (req.method === 'GET') {
      const row = await fetchCurrentRow()
      const normalizedState = row?.state_json ? normalizeRemoteState(row.state_json) : null
      return sendJson(res, 200, {
        ok: true,
        state: normalizedState,
        updatedAt: row?.updated_at ?? null,
        schemaVersion: row?.schema_version ?? SCHEMA_VERSION,
      })
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const incomingState = normalizeRemoteState(payload?.state)
    if (!incomingState) {
      return sendJson(res, 400, { ok: false, error: 'Invalid sync payload.' })
    }

    const existingRow = await fetchCurrentRow()
    const mergedState = mergeRemoteAndLocalState(
      existingRow?.state_json ? normalizeRemoteState(existingRow.state_json) : emptyRemoteState(),
      incomingState,
    )
    mergedState.updatedAt = Date.now()

    const saved = await upsertRow(mergedState)
    return sendJson(res, 200, {
      ok: true,
      acceptedState: saved.state_json,
      updatedAt: saved.updated_at,
      schemaVersion: saved.schema_version,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected sync error.'
    return sendJson(res, 500, { ok: false, error: message })
  }
}

function validateEnv() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SYNC_SHARED_SECRET) {
    return 'Cloud sync is not configured on the server yet.'
  }
  return null
}

async function fetchCurrentRow() {
  const response = await fetch(`${restBaseUrl()}/app_state?scope=eq.${SCOPE}&select=*`, {
    headers: supabaseHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Failed to read cloud state (${response.status}).`)
  }

  const rows = await response.json()
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null
}

async function upsertRow(state) {
  const updatedAt = new Date().toISOString()
  const response = await fetch(`${restBaseUrl()}/app_state?on_conflict=scope`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(),
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify([
      {
        scope: SCOPE,
        state_json: state,
        schema_version: SCHEMA_VERSION,
        updated_at: updatedAt,
        updated_by: 'shared-secret-sync',
      },
    ]),
  })

  if (!response.ok) {
    throw new Error(`Failed to save cloud state (${response.status}).`)
  }

  const rows = await response.json()
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('Cloud sync returned an empty save response.')
  }

  return rows[0]
}

function restBaseUrl() {
  return `${process.env.SUPABASE_URL}/rest/v1`
}

function supabaseHeaders() {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
  }
}

function sendJson(res, status, payload) {
  res.status(status).json(payload)
}

function emptyRemoteState() {
  return {
    trackedSetups: [],
    trackedSignals: [],
    trackedOutcomes: [],
    trackerLastRunAt: null,
    riskInputs: {
      coin: 'BTC',
      direction: 'long',
      entryPrice: 0,
      accountSize: 1000,
      positionSize: 100,
      leverage: 5,
      stopPrice: null,
      targetPrice: null,
    },
    riskInputsUpdatedAt: null,
    updatedAt: 0,
  }
}

function normalizeRemoteState(value) {
  if (!value || typeof value !== 'object') {
    return null
  }

  return {
    trackedSetups: Array.isArray(value.trackedSetups) ? value.trackedSetups : [],
    trackedSignals: Array.isArray(value.trackedSignals) ? value.trackedSignals : [],
    trackedOutcomes: Array.isArray(value.trackedOutcomes) ? value.trackedOutcomes : [],
    trackerLastRunAt: typeof value.trackerLastRunAt === 'number' ? value.trackerLastRunAt : null,
    riskInputs: isRiskInputsShape(value.riskInputs) ? value.riskInputs : emptyRemoteState().riskInputs,
    riskInputsUpdatedAt: typeof value.riskInputsUpdatedAt === 'number' ? value.riskInputsUpdatedAt : null,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : 0,
  }
}

function mergeRemoteAndLocalState(baseState, incomingState) {
  return {
    trackedSetups: mergeTrackedSetups(baseState.trackedSetups, incomingState.trackedSetups),
    trackedSignals: mergeTrackedSignals(baseState.trackedSignals, incomingState.trackedSignals),
    trackedOutcomes: mergeTrackedOutcomes(baseState.trackedOutcomes, incomingState.trackedOutcomes),
    trackerLastRunAt: Math.max(baseState.trackerLastRunAt ?? 0, incomingState.trackerLastRunAt ?? 0) || null,
    riskInputs:
      (incomingState.riskInputsUpdatedAt ?? 0) > (baseState.riskInputsUpdatedAt ?? 0)
        ? incomingState.riskInputs
        : baseState.riskInputs,
    riskInputsUpdatedAt:
      Math.max(baseState.riskInputsUpdatedAt ?? 0, incomingState.riskInputsUpdatedAt ?? 0) || null,
    updatedAt: Math.max(baseState.updatedAt ?? 0, incomingState.updatedAt ?? 0),
  }
}

function mergeTrackedSetups(baseSetups, incomingSetups) {
  const merged = new Map()
  for (const item of [...baseSetups, ...incomingSetups]) {
    const current = merged.get(item.id)
    if (!current) {
      merged.set(item.id, item)
      continue
    }
    merged.set(item.id, pickMoreCompleteSetup(current, item))
  }
  return [...merged.values()].sort((a, b) => a.setup.generatedAt - b.setup.generatedAt)
}

function pickMoreCompleteSetup(left, right) {
  const leftScore = setupCompletenessScore(left)
  const rightScore = setupCompletenessScore(right)
  if (rightScore > leftScore) {
    return right
  }
  if (leftScore > rightScore) {
    return left
  }

  return latestResolvedAt(right) > latestResolvedAt(left) ? right : left
}

function setupCompletenessScore(setup) {
  const outcomes = Object.values(setup.outcomes ?? {})
  const resolved = outcomes.filter((outcome) => outcome?.result && outcome.result !== 'pending').length
  const metadata = outcomes.filter((outcome) => outcome?.resolutionReason || outcome?.candleCountUsed).length
  const coverage = setup.coverageStatus === 'full' ? 2 : setup.coverageStatus === 'partial' ? 1 : 0
  return resolved * 10 + metadata * 2 + coverage
}

function latestResolvedAt(setup) {
  return Math.max(...Object.values(setup.outcomes ?? {}).map((outcome) => outcome?.resolvedAt ?? 0), 0)
}

function mergeTrackedSignals(baseSignals, incomingSignals) {
  const merged = new Map()
  for (const record of [...baseSignals, ...incomingSignals]) {
    merged.set(record.id, record)
  }
  return [...merged.values()].sort((a, b) => a.timestamp - b.timestamp)
}

function mergeTrackedOutcomes(baseOutcomes, incomingOutcomes) {
  const merged = new Map()
  for (const outcome of [...baseOutcomes, ...incomingOutcomes]) {
    const key = `${outcome.recordId}:${outcome.window}`
    const current = merged.get(key)
    if (!current) {
      merged.set(key, outcome)
      continue
    }

    const currentResolved = current.resolvedAt !== null
    const incomingResolved = outcome.resolvedAt !== null
    if (!currentResolved && incomingResolved) {
      merged.set(key, outcome)
      continue
    }
    if (currentResolved && incomingResolved && (outcome.resolvedAt ?? 0) > (current.resolvedAt ?? 0)) {
      merged.set(key, outcome)
    }
  }

  return [...merged.values()].sort((a, b) =>
    `${a.recordId}:${a.window}`.localeCompare(`${b.recordId}:${b.window}`),
  )
}

function isRiskInputsShape(value) {
  if (!value || typeof value !== 'object') {
    return false
  }

  return (
    typeof value.coin === 'string' &&
    typeof value.direction === 'string' &&
    typeof value.entryPrice === 'number' &&
    typeof value.accountSize === 'number' &&
    typeof value.positionSize === 'number' &&
    typeof value.leverage === 'number'
  )
}

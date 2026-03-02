import {
  emptyRemoteState,
  normalizeRemoteState,
  mergeRemoteAndLocalState,
} from './_sync-policy.mjs'

const SCHEMA_VERSION = 1
const GLOBAL_SCOPE = 'global'

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return sendJson(res, 405, { ok: false, error: 'Method not allowed.' })
  }

  const envError = validateEnv()
  if (envError) {
    return sendJson(res, 503, { ok: false, error: envError })
  }

  try {
    if (req.method === 'GET') {
      const row = await fetchCurrentRow(GLOBAL_SCOPE)
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

    const existingRow = await fetchCurrentRow(GLOBAL_SCOPE)
    const mergedState = mergeRemoteAndLocalState(
      existingRow?.state_json ? normalizeRemoteState(existingRow.state_json) : emptyRemoteState(),
      incomingState,
    )
    mergedState.updatedAt = Date.now()

    const saved = await upsertRow(GLOBAL_SCOPE, mergedState)
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
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return 'Cloud sync is not configured on the server yet.'
  }
  return null
}

async function fetchCurrentRow(scope) {
  const response = await fetch(`${restBaseUrl()}/app_state?scope=eq.${scope}&select=*`, {
    headers: supabaseHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Failed to read cloud state (${response.status}).`)
  }

  const rows = await response.json()
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null
}

async function upsertRow(scope, state) {
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
        scope,
        state_json: state,
        schema_version: SCHEMA_VERSION,
        updated_at: updatedAt,
        updated_by: 'global-sync',
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

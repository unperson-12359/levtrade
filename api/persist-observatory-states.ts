import { CONTRACT_VERSION_V1 } from './_contracts.js'
import { TRACKED_COINS } from './_signals.mjs'
import { CRON_PERSISTENCE_DAYS, authorizePersistenceRequest, persistObservatoryLookback } from './_observatoryPersistence.js'
import type { ObservatoryInterval } from './_hyperliquid.js'

interface VercelRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  query: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

const PERSISTENCE_INTERVALS: readonly ObservatoryInterval[] = ['4h', '1d']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const method = req.method ?? 'GET'
  const isCronRequest = method === 'GET' && isTrustedCronRequest(req.headers)

  if (method !== 'POST' && !isCronRequest) {
    return res.status(405).json({ ok: false, error: 'Method not allowed', contractVersion: CONTRACT_VERSION_V1 })
  }

  const authorization = authorizePersistenceRequest({
    authorizationHeader: req.headers.authorization,
    headerSecret: req.headers['x-observatory-persist-secret'],
  })

  if (!authorization.ok) {
    const statusCode = authorization.reason.startsWith('Missing ') ? 500 : 401
    return res.status(statusCode).json({ ok: false, error: authorization.reason, contractVersion: CONTRACT_VERSION_V1 })
  }

  try {
    const results = []
    for (const coin of TRACKED_COINS) {
      for (const interval of PERSISTENCE_INTERVALS) {
        const days = CRON_PERSISTENCE_DAYS[interval]
        results.push(await persistObservatoryLookback({ coin, interval, days }))
      }
    }

    return res.status(200).json({
      ok: true,
      contractVersion: CONTRACT_VERSION_V1,
      mode: isCronRequest ? 'cron' : 'manual',
      markets: results,
      totalRows: results.reduce((sum, entry) => sum + entry.upsertedRows, 0),
      generatedAt: Date.now(),
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      contractVersion: CONTRACT_VERSION_V1,
      error: error instanceof Error ? error.message : 'Unexpected persistence error',
    })
  }
}

function isTrustedCronRequest(headers: Record<string, string | string[] | undefined>) {
  const userAgent = firstHeaderValue(headers['user-agent']) ?? ''
  const vercelCronHeader = firstHeaderValue(headers['x-vercel-cron']) ?? ''
  return userAgent.startsWith('vercel-cron/') || vercelCronHeader.length > 0
}

function firstHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

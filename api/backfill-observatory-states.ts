import { CONTRACT_VERSION_V1 } from './_contracts.js'
import { authorizePersistenceRequest, persistObservatoryLookback } from './_observatoryPersistence.js'
import { parsePositiveInteger, resolveCoin, resolveObservatoryInterval } from './_hyperliquid.js'

interface VercelRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  query: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

const DEFAULT_BACKFILL_DAYS = 180

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed', contractVersion: CONTRACT_VERSION_V1 })
  }

  const authorization = authorizePersistenceRequest({
    authorizationHeader: req.headers.authorization,
    headerSecret: req.headers['x-observatory-persist-secret'],
    querySecret: req.query.secret,
  })

  if (!authorization.ok) {
    const statusCode = authorization.reason.startsWith('Missing ') ? 500 : 401
    return res.status(statusCode).json({ ok: false, error: authorization.reason, contractVersion: CONTRACT_VERSION_V1 })
  }

  const coin = resolveCoin(req.query.coin)
  const interval = resolveObservatoryInterval(req.query.interval)
  const days = parsePositiveInteger(req.query.days, DEFAULT_BACKFILL_DAYS, { min: 1, max: 365 })

  try {
    const result = await persistObservatoryLookback({
      coin,
      interval,
      days,
    })

    return res.status(200).json({
      ok: true,
      contractVersion: CONTRACT_VERSION_V1,
      mode: 'backfill',
      market: result,
      generatedAt: Date.now(),
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      contractVersion: CONTRACT_VERSION_V1,
      error: error instanceof Error ? error.message : 'Unexpected backfill error',
    })
  }
}

import { runCollector } from './_collector.mjs'

interface VercelRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const secret = req.headers['x-cron-secret'] as string | undefined
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }

  try {
    const result = await runCollector()

    return res.status(200).json({
      ok: true,
      processedAt: new Date(result.processedAt).toISOString(),
      results: result.results,
    })
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Unexpected error',
    })
  }
}

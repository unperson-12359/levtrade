import type { ExecutionEventV1 } from '../../src/contracts/v1'
import { buildContractMeta, computeFreshnessStatus, CONTRACT_VERSION_V1 } from '../_contracts.js'
import { fetchSupabaseRows, getSupabaseEnv } from '../_supabase.js'

interface VercelRequest {
  method?: string
  query: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

interface VercelSseResponse extends VercelResponse {
  setHeader: (name: string, value: string) => void
  write: (chunk: string) => void
  end: () => void
}

const HEARTBEAT_STALE_AFTER_MS = 15 * 60 * 1000
const DEFAULT_STALE_AFTER_MS = 24 * 60 * 60 * 1000
const COLLECTOR_NAME = 'primary'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed', contractVersion: CONTRACT_VERSION_V1 })
  }

  const supabase = getSupabaseEnv()
  if (!supabase) {
    return res.status(503).json({
      ok: false,
      error: 'Not configured',
      contractVersion: CONTRACT_VERSION_V1,
      meta: buildContractMeta({
        source: 'canonical',
        lastSuccessfulAtMs: null,
        freshness: 'error',
        staleAfterMs: DEFAULT_STALE_AFTER_MS,
      }),
    })
  }

  try {
    const now = Date.now()
    const [heartbeatRows, setupRows, signalRows] = await Promise.all([
      fetchSupabaseRows<{
        collector_name: string
        last_run_at: string | null
        last_success_at: string | null
        last_error: string | null
        updated_at: string | null
      }>({
        env: supabase,
        table: 'collector_heartbeat',
        query: new URLSearchParams({
          collector_name: `eq.${COLLECTOR_NAME}`,
          limit: '1',
          select: 'collector_name,last_run_at,last_success_at,last_error,updated_at',
        }),
      }),
      fetchSupabaseRows<{
        id: string
        generated_at: string
        updated_at: string | null
        coin: string
      }>({
        env: supabase,
        table: 'server_setups',
        query: new URLSearchParams({
          scope: 'eq.global',
          order: 'generated_at.desc',
          limit: '1',
          select: 'id,generated_at,updated_at,coin',
        }),
      }),
      fetchSupabaseRows<{
        id: string
        updated_at: string | null
        recorded_at: string
      }>({
        env: supabase,
        table: 'tracked_signals',
        query: new URLSearchParams({
          scope: 'eq.global',
          order: 'recorded_at.desc',
          limit: '1',
          select: 'id,updated_at,recorded_at',
        }),
      }),
    ])

    const heartbeat = heartbeatRows[0]
    const latestSetup = setupRows[0]
    const latestSignal = signalRows[0]
    const collectorLastSuccessMs = heartbeat?.last_success_at ? Date.parse(heartbeat.last_success_at) : null
    const collectorLastRunMs = heartbeat?.last_run_at ? Date.parse(heartbeat.last_run_at) : null
    const collectorStatus =
      heartbeat?.last_error && (!collectorLastSuccessMs || now - collectorLastSuccessMs > HEARTBEAT_STALE_AFTER_MS)
        ? 'error'
        : collectorLastRunMs && now - collectorLastRunMs <= HEARTBEAT_STALE_AFTER_MS
          ? 'live'
          : 'stale'
    const setupUpdatedAtMs = latestSetup ? Date.parse(latestSetup.updated_at ?? latestSetup.generated_at) : null
    const signalUpdatedAtMs = latestSignal ? Date.parse(latestSignal.updated_at ?? latestSignal.recorded_at) : null

    const events: ExecutionEventV1[] = []
    if (heartbeat) {
      events.push({
        contractVersion: CONTRACT_VERSION_V1,
        id: `collector-${heartbeat.updated_at ?? heartbeat.last_run_at ?? now}`,
        type: 'collector.heartbeat',
        level: collectorStatus === 'live' ? 'info' : collectorStatus === 'stale' ? 'warn' : 'error',
        source: 'collector',
        time: new Date(now).toISOString(),
        summary:
          collectorStatus === 'live'
            ? 'Collector heartbeat is live.'
            : collectorStatus === 'stale'
              ? 'Collector heartbeat is stale.'
              : 'Collector heartbeat reports an error.',
        details: {
          status: collectorStatus,
          lastRunAt: heartbeat.last_run_at,
          lastSuccessAt: heartbeat.last_success_at,
          lastError: heartbeat.last_error,
        },
      })
    }

    if (latestSetup) {
      const setupFreshness = computeFreshnessStatus({
        nowMs: now,
        lastSuccessfulAtMs: setupUpdatedAtMs,
        delayedAfterMs: DEFAULT_STALE_AFTER_MS,
      })
      events.push({
        contractVersion: CONTRACT_VERSION_V1,
        id: `setup-${latestSetup.id}-${latestSetup.updated_at ?? latestSetup.generated_at}`,
        type: 'canonical.setup-history',
        level: setupFreshness === 'fresh' ? 'info' : 'warn',
        source: 'api',
        time: new Date(now).toISOString(),
        summary: `Latest canonical setup for ${latestSetup.coin} is ${setupFreshness}.`,
        details: {
          setupId: latestSetup.id,
          updatedAt: latestSetup.updated_at,
          generatedAt: latestSetup.generated_at,
          freshness: setupFreshness,
        },
      })
    }

    if (latestSignal) {
      const signalFreshness = computeFreshnessStatus({
        nowMs: now,
        lastSuccessfulAtMs: signalUpdatedAtMs,
        delayedAfterMs: DEFAULT_STALE_AFTER_MS,
      })
      events.push({
        contractVersion: CONTRACT_VERSION_V1,
        id: `accuracy-${latestSignal.id}-${latestSignal.updated_at ?? latestSignal.recorded_at}`,
        type: 'canonical.signal-accuracy',
        level: signalFreshness === 'fresh' ? 'info' : 'warn',
        source: 'api',
        time: new Date(now).toISOString(),
        summary: `Signal-accuracy pipeline is ${signalFreshness}.`,
        details: {
          signalId: latestSignal.id,
          updatedAt: latestSignal.updated_at,
          recordedAt: latestSignal.recorded_at,
          freshness: signalFreshness,
        },
      })
    }

    const lastSuccessfulAtMs = maxNullable(collectorLastSuccessMs ?? collectorLastRunMs, maxNullable(setupUpdatedAtMs, signalUpdatedAtMs))
    const meta = buildContractMeta({
      source: 'canonical',
      lastSuccessfulAtMs,
      staleAfterMs: DEFAULT_STALE_AFTER_MS,
      freshness: events.length === 0 ? 'error' : undefined,
      nowMs: now,
    })

    if (firstQueryValue(req.query.mode) === 'poll') {
      return res.status(200).json({
        ok: true,
        contractVersion: CONTRACT_VERSION_V1,
        events,
        meta,
      })
    }

    if (!isSseResponse(res)) {
      return res.status(200).json({
        ok: true,
        contractVersion: CONTRACT_VERSION_V1,
        events,
        meta,
      })
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.write('retry: 15000\n')
    for (const event of events) {
      res.write(`id: ${event.id}\n`)
      res.write('event: execution\n')
      res.write(`data: ${JSON.stringify(event)}\n\n`)
    }
    res.write(`event: snapshot\ndata: ${JSON.stringify({ contractVersion: CONTRACT_VERSION_V1, meta })}\n\n`)
    res.end()
    return
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unexpected error',
      contractVersion: CONTRACT_VERSION_V1,
      meta: buildContractMeta({
        source: 'canonical',
        lastSuccessfulAtMs: null,
        freshness: 'error',
        staleAfterMs: DEFAULT_STALE_AFTER_MS,
      }),
    })
  }
}

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return typeof value === 'string' ? value : null
}

function maxNullable(a: number | null, b: number | null): number | null {
  if (Number.isFinite(a) && Number.isFinite(b)) return Math.max(a as number, b as number)
  if (Number.isFinite(a)) return a as number
  if (Number.isFinite(b)) return b as number
  return null
}

function isSseResponse(response: VercelResponse): response is VercelSseResponse {
  const candidate = response as Partial<VercelSseResponse>
  return (
    typeof candidate.setHeader === 'function' &&
    typeof candidate.write === 'function' &&
    typeof candidate.end === 'function'
  )
}

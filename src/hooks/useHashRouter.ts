import { useCallback, useEffect, useState } from 'react'
import { TRACKED_COINS, type TrackedCoin } from '../types/market'

type AllowedInterval = '1d'
type ObservatoryRoutePage = 'observatory' | 'report' | 'analytics' | 'methodology'

export interface ObservatoryRoute {
  page: ObservatoryRoutePage
  coin: TrackedCoin | null
  interval: AllowedInterval | null
  time: number | null
}

interface MarketRouteContext {
  coin?: TrackedCoin | null
  interval?: AllowedInterval | null
}

function parseHash(hash: string): ObservatoryRoute {
  const raw = hash.trim()
  const fallback: ObservatoryRoute = { page: 'observatory', coin: null, interval: null, time: null }
  if (!raw) return fallback

  const withoutHash = raw.startsWith('#') ? raw.slice(1) : raw
  if (!withoutHash.startsWith('/observatory') && !withoutHash.startsWith('/analytics') && !withoutHash.startsWith('/methodology')) {
    return fallback
  }

  const [pathPart = '', queryPart = ''] = withoutHash.split('?')
  const page: ObservatoryRoutePage = pathPart.startsWith('/analytics')
    ? 'analytics'
    : pathPart.startsWith('/methodology')
      ? 'methodology'
    : pathPart.includes('/report')
      ? 'report'
      : 'observatory'
  const query = new URLSearchParams(queryPart)
  const rawCoin = query.get('coin')
  const rawInterval = query.get('interval')
  const rawTime = query.get('time')

  const coin = rawCoin && TRACKED_COINS.includes(rawCoin as TrackedCoin) ? (rawCoin as TrackedCoin) : null
  const interval: AllowedInterval | null = rawInterval === '1d' ? rawInterval : null
  const time = rawTime && Number.isFinite(Number(rawTime)) ? Number(rawTime) : null

  return { page, coin, interval, time }
}

function buildReportHash(coin: string, interval: string, time: number): string {
  const params = new URLSearchParams()
  params.set('coin', coin)
  params.set('interval', interval)
  params.set('time', String(time))
  return `#/observatory/report?${params.toString()}`
}

function buildObservatoryHash(context?: MarketRouteContext): string {
  const params = buildMarketParams(context)
  return params ? `#/observatory?${params}` : '#/observatory'
}

function buildAnalyticsHash(context?: MarketRouteContext): string {
  const params = buildMarketParams(context)
  return params ? `#/analytics?${params}` : '#/analytics'
}

function buildMethodologyHash(context?: MarketRouteContext): string {
  const params = buildMarketParams(context)
  return params ? `#/methodology?${params}` : '#/methodology'
}

function buildMarketParams(context?: MarketRouteContext) {
  const params = new URLSearchParams()
  if (context?.coin) {
    params.set('coin', context.coin)
  }
  if (context?.interval) {
    params.set('interval', context.interval)
  }
  const serialized = params.toString()
  return serialized.length > 0 ? serialized : null
}

export function useHashRouter() {
  const [route, setRoute] = useState<ObservatoryRoute>(() => parseHash(window.location.hash))

  useEffect(() => {
    const sync = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', sync)
    window.addEventListener('popstate', sync)

    if (!window.location.hash) {
      const defaultHash = buildObservatoryHash({ coin: 'BTC', interval: '1d' })
      history.replaceState(null, '', defaultHash)
      setRoute(parseHash(defaultHash))
    }

    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('popstate', sync)
    }
  }, [])

  const navigate = useCallback((hash: string, opts?: { replace?: boolean }) => {
    if (opts?.replace) {
      history.replaceState(null, '', hash)
    } else {
      history.pushState(null, '', hash)
    }
    setRoute(parseHash(hash))
  }, [])

  const navigateToHeatmap = useCallback((coin?: TrackedCoin, interval?: AllowedInterval, opts?: { replace?: boolean }) => {
    navigate(buildObservatoryHash({ coin, interval }), opts)
  }, [navigate])

  const navigateToObservatory = useCallback((coin?: TrackedCoin, interval?: AllowedInterval, opts?: { replace?: boolean }) => {
    navigate(buildObservatoryHash({ coin, interval }), opts)
  }, [navigate])

  const navigateToReport = useCallback(
    (coin: string, interval: string, time: number, opts?: { replace?: boolean }) => {
      navigate(buildReportHash(coin, interval, time), opts)
    },
    [navigate],
  )

  const navigateToAnalytics = useCallback((coin?: TrackedCoin, interval?: AllowedInterval, opts?: { replace?: boolean }) => {
    navigate(buildAnalyticsHash({ coin, interval }), opts)
  }, [navigate])

  const navigateToMethodology = useCallback((coin?: TrackedCoin, interval?: AllowedInterval, opts?: { replace?: boolean }) => {
    navigate(buildMethodologyHash({ coin, interval }), opts)
  }, [navigate])

  return {
    route,
    navigate,
    navigateToHeatmap,
    navigateToObservatory,
    navigateToAnalytics,
    navigateToMethodology,
    navigateToReport,
  } as const
}

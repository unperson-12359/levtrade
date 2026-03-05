import { MARKET_MOMENT_FUTURE_HOURS, MARKET_MOMENT_LABELS, MARKET_MOMENT_LOOKBACK_HOURS, MACRO_EVENT_SCHEDULE_UTC } from '../config/marketMoments'
import type { Candle } from '../types/market'
import type {
  MarketMomentAggregate,
  MarketMomentCategory,
  MarketMomentSnapshot,
  MarketMomentType,
  UpcomingMarketMoment,
} from '../types/marketMoments'
import type { SignalColor } from '../types/signals'
import { ceilToHour, floorToHour, MS_PER_HOUR } from '../utils/candleTime'

type MomentInstance = {
  type: MarketMomentType
  category: MarketMomentCategory
  time: number
  importance: 'high' | 'medium'
}

type MomentObservation = {
  time: number
  move1hPct: number
  move4hPct: number
}

type SessionRule = {
  type: Extract<MarketMomentType, 'us_cash_open' | 'us_cash_close' | 'london_open' | 'london_close' | 'tokyo_open' | 'tokyo_close'>
  timeZone: string
  hour: number
  weekdaysOnly: boolean
  importance: 'high' | 'medium'
}

const SESSION_RULES: SessionRule[] = [
  { type: 'us_cash_open', timeZone: 'America/New_York', hour: 10, weekdaysOnly: true, importance: 'high' },
  { type: 'us_cash_close', timeZone: 'America/New_York', hour: 16, weekdaysOnly: true, importance: 'high' },
  { type: 'london_open', timeZone: 'Europe/London', hour: 8, weekdaysOnly: true, importance: 'medium' },
  { type: 'london_close', timeZone: 'Europe/London', hour: 16, weekdaysOnly: true, importance: 'medium' },
  { type: 'tokyo_open', timeZone: 'Asia/Tokyo', hour: 9, weekdaysOnly: true, importance: 'medium' },
  { type: 'tokyo_close', timeZone: 'Asia/Tokyo', hour: 15, weekdaysOnly: true, importance: 'medium' },
]

const formatterCache = new Map<string, Intl.DateTimeFormat>()

export function computeMarketMomentSnapshot(
  candles: Candle[],
  now: number = Date.now(),
): MarketMomentSnapshot {
  if (candles.length < 6) {
    return {
      generatedAt: now,
      lookbackHours: MARKET_MOMENT_LOOKBACK_HOURS,
      candleCount: candles.length,
      topMoments: [],
      nextMoments: [],
    }
  }

  const sortedCandles = [...candles].sort((left, right) => left.time - right.time)
  const bucketMap = new Map<number, Candle>()
  for (const candle of sortedCandles) {
    bucketMap.set(floorToHour(candle.time), candle)
  }

  const lookbackStart = now - MARKET_MOMENT_LOOKBACK_HOURS * MS_PER_HOUR
  const historyInstances = collectMomentInstances(lookbackStart, now)
  const grouped = new Map<MarketMomentType, MomentObservation[]>()

  for (const instance of historyInstances) {
    const base = bucketMap.get(floorToHour(instance.time))
    const plus1h = bucketMap.get(floorToHour(instance.time + MS_PER_HOUR))
    const plus4h = bucketMap.get(floorToHour(instance.time + 4 * MS_PER_HOUR))
    if (!base || !plus1h || !plus4h || base.close <= 0) {
      continue
    }

    const move1hPct = pctMove(base.close, plus1h.close)
    const move4hPct = pctMove(base.close, plus4h.close)
    const existing = grouped.get(instance.type) ?? []
    existing.push({ time: instance.time, move1hPct, move4hPct })
    grouped.set(instance.type, existing)
  }

  const topMoments: MarketMomentAggregate[] = []
  for (const [type, observations] of grouped.entries()) {
    const aggregate = aggregateMoment(type, observations)
    if (aggregate) {
      topMoments.push(aggregate)
    }
  }

  topMoments.sort((left, right) => right.impactScore - left.impactScore)

  const nextMoments = collectUpcomingMoments(now, now + MARKET_MOMENT_FUTURE_HOURS * MS_PER_HOUR)

  return {
    generatedAt: now,
    lookbackHours: MARKET_MOMENT_LOOKBACK_HOURS,
    candleCount: sortedCandles.length,
    topMoments: topMoments.slice(0, 4),
    nextMoments: nextMoments.slice(0, 6),
  }
}

function collectMomentInstances(startTime: number, endTime: number): MomentInstance[] {
  const instances: MomentInstance[] = []

  for (let t = floorToHour(startTime); t <= endTime; t += MS_PER_HOUR) {
    const utcDate = new Date(t)
    const utcHour = utcDate.getUTCHours()
    const utcDay = utcDate.getUTCDate()
    const utcMonth = utcDate.getUTCMonth()
    const utcYear = utcDate.getUTCFullYear()
    const lastDay = new Date(Date.UTC(utcYear, utcMonth + 1, 0)).getUTCDate()

    if (utcDay === 1 && utcHour === 0) {
      instances.push({ type: 'month_open', category: 'turn', time: t, importance: 'medium' })
      if (utcMonth === 0 || utcMonth === 3 || utcMonth === 6 || utcMonth === 9) {
        instances.push({ type: 'quarter_open', category: 'turn', time: t, importance: 'high' })
      }
    }

    if (utcDay === lastDay && utcHour === 23) {
      instances.push({ type: 'month_end', category: 'turn', time: t, importance: 'high' })
      if (utcMonth === 2 || utcMonth === 5 || utcMonth === 8 || utcMonth === 11) {
        instances.push({ type: 'quarter_end', category: 'turn', time: t, importance: 'high' })
      }
    }

    for (const rule of SESSION_RULES) {
      const local = localDateParts(t, rule.timeZone)
      if (!local) continue
      if (rule.weekdaysOnly && (local.weekday === 0 || local.weekday === 6)) continue
      if (local.hour === rule.hour) {
        instances.push({ type: rule.type, category: 'session', time: t, importance: rule.importance })
      }
    }
  }

  for (const event of MACRO_EVENT_SCHEDULE_UTC) {
    const eventTime = Date.parse(event.timeUtc)
    if (!Number.isFinite(eventTime)) continue
    const bucketTime = floorToHour(eventTime)
    if (bucketTime < startTime || bucketTime > endTime) continue
    instances.push({
      type: event.type,
      category: 'macro',
      time: bucketTime,
      importance: event.importance,
    })
  }

  return instances
}

function collectUpcomingMoments(now: number, horizonEnd: number): UpcomingMarketMoment[] {
  const upcoming: UpcomingMarketMoment[] = []

  const forwardInstances = collectMomentInstances(now, horizonEnd)
  for (const instance of forwardInstances) {
    if (instance.time <= now) continue
    upcoming.push({
      type: instance.type,
      category: instance.category,
      label: MARKET_MOMENT_LABELS[instance.type],
      eventTime: instance.time,
      secondsUntil: Math.max(0, Math.floor((instance.time - now) / 1000)),
      importance: instance.importance,
      note: instance.category === 'macro' ? 'Scheduled macro event (manual UTC calendar)' : undefined,
    })
  }

  upcoming.sort((left, right) => left.eventTime - right.eventTime)
  return dedupeUpcoming(upcoming)
}

function dedupeUpcoming(items: UpcomingMarketMoment[]): UpcomingMarketMoment[] {
  const seen = new Set<string>()
  const deduped: UpcomingMarketMoment[] = []
  for (const item of items) {
    const key = `${item.type}:${item.eventTime}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(item)
  }
  return deduped
}

function aggregateMoment(
  type: MarketMomentType,
  observations: MomentObservation[],
): MarketMomentAggregate | null {
  if (observations.length === 0) return null

  const sampleCount = observations.length
  const avgAbsMovePct1h = observations.reduce((sum, item) => sum + Math.abs(item.move1hPct), 0) / sampleCount
  const avgSignedMovePct1h = observations.reduce((sum, item) => sum + item.move1hPct, 0) / sampleCount
  const avgFollowThroughPct4h = observations.reduce((sum, item) => sum + item.move4hPct, 0) / sampleCount
  const latest = observations[observations.length - 1] ?? null
  const consistency = avgAbsMovePct1h > 0.01 ? Math.abs(avgSignedMovePct1h) / avgAbsMovePct1h : 0
  const impactScore = avgAbsMovePct1h * (1 + consistency * 0.4)
  const tone = impactTone(avgAbsMovePct1h)
  const category = momentCategory(type)

  return {
    type,
    category,
    label: MARKET_MOMENT_LABELS[type],
    sampleCount,
    avgAbsMovePct1h,
    avgSignedMovePct1h,
    avgFollowThroughPct4h,
    latestEventTime: latest?.time ?? null,
    latestMovePct1h: latest?.move1hPct ?? null,
    impactScore,
    tone,
    summary: momentSummary(avgAbsMovePct1h, avgSignedMovePct1h, sampleCount),
  }
}

function momentCategory(type: MarketMomentType): MarketMomentCategory {
  if (type === 'cpi' || type === 'nfp' || type === 'fomc' || type === 'rate_decision') return 'macro'
  if (type === 'month_open' || type === 'month_end' || type === 'quarter_open' || type === 'quarter_end') return 'turn'
  return 'session'
}

function momentSummary(avgAbsMovePct1h: number, avgSignedMovePct1h: number, sampleCount: number): string {
  const direction =
    avgSignedMovePct1h > 0.12
      ? 'upward'
      : avgSignedMovePct1h < -0.12
        ? 'downward'
        : 'mixed'

  if (sampleCount < 3) {
    return 'Early sample size. Treat this as observational context.'
  }

  if (avgAbsMovePct1h >= 1) {
    return `Historically high-impact window with ${direction} tendency in the first hour.`
  }
  if (avgAbsMovePct1h >= 0.5) {
    return `Moderate-impact window. First-hour behavior has been ${direction}.`
  }
  return 'Historically lower-impact window in this recent sample.'
}

function impactTone(avgAbsMovePct1h: number): SignalColor {
  if (avgAbsMovePct1h >= 1.2) return 'red'
  if (avgAbsMovePct1h >= 0.6) return 'yellow'
  return 'green'
}

function pctMove(base: number, next: number): number {
  if (!Number.isFinite(base) || !Number.isFinite(next) || base <= 0) return 0
  return ((next - base) / base) * 100
}

function localDateParts(timestamp: number, timeZone: string): {
  year: number
  month: number
  day: number
  hour: number
  weekday: number
} | null {
  const formatter = getFormatter(timeZone)
  const parts = formatter.formatToParts(new Date(timestamp))

  const year = readPart(parts, 'year')
  const month = readPart(parts, 'month')
  const day = readPart(parts, 'day')
  const hour = readPart(parts, 'hour')

  if (year === null || month === null || day === null || hour === null) {
    return null
  }

  const date = new Date(Date.UTC(year, month - 1, day))
  return {
    year,
    month,
    day,
    hour,
    weekday: date.getUTCDay(),
  }
}

function readPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number | null {
  const value = parts.find((part) => part.type === type)?.value
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  const existing = formatterCache.get(timeZone)
  if (existing) return existing

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  })
  formatterCache.set(timeZone, formatter)
  return formatter
}

export function formatMomentCountdown(secondsUntil: number): string {
  if (secondsUntil <= 0) return 'now'
  const totalMinutes = Math.floor(secondsUntil / 60)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return `in ${days}d ${hours}h`
  if (hours > 0) return `in ${hours}h ${minutes}m`
  return `in ${minutes}m`
}

export function nextMomentTone(secondsUntil: number | null, importance: 'high' | 'medium' | null): SignalColor {
  if (secondsUntil === null || importance === null) return 'yellow'
  if (importance === 'high' && secondsUntil <= 2 * 60 * 60) return 'red'
  if (importance === 'high' && secondsUntil <= 8 * 60 * 60) return 'yellow'
  if (secondsUntil <= 2 * 60 * 60) return 'yellow'
  return 'green'
}

export function buildMomentSnapshotFromHourlyCandles(
  candles: Candle[],
  now: number = Date.now(),
): MarketMomentSnapshot {
  const normalized = candles
    .map((candle) => ({ ...candle, time: floorToHour(candle.time) }))
    .sort((left, right) => left.time - right.time)
  return computeMarketMomentSnapshot(normalized, ceilToHour(now))
}

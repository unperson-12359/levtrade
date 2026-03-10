const UTC_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
})

const UTC_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

const UTC_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  hour: 'numeric',
  minute: '2-digit',
})

export function formatUtcDateTime(value: number | string | null | undefined): string {
  const time = parseTimeValue(value)
  if (!Number.isFinite(time)) return '--'
  return `${UTC_DATE_TIME_FORMATTER.format(time)} UTC`
}

export function formatUtcDate(value: number | string | null | undefined): string {
  const time = parseTimeValue(value)
  if (!Number.isFinite(time)) return '--'
  return `${UTC_DATE_FORMATTER.format(time)} UTC`
}

export function formatUtcTime(value: number | string | null | undefined): string {
  const time = parseTimeValue(value)
  if (!Number.isFinite(time)) return '--'
  return `${UTC_TIME_FORMATTER.format(time)} UTC`
}

function parseTimeValue(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Date.parse(value)
  return Number.NaN
}

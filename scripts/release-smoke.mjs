const DEFAULT_BASE_URL = 'https://levtrade.vercel.app'
const DEFAULT_COIN = 'BTC'
const DEFAULT_INTERVAL = '1d'
const DEFAULT_DAYS = 180

const args = parseArgs(process.argv.slice(2))
const baseUrl = (args['base-url'] ?? DEFAULT_BASE_URL).replace(/\/$/, '')
const coin = args.coin ?? DEFAULT_COIN
const interval = args.interval ?? DEFAULT_INTERVAL
const days = Number.parseInt(args.days ?? String(DEFAULT_DAYS), 10)

await checkRoot(baseUrl)
await checkSnapshot(baseUrl, coin, interval)
await checkAnalytics(baseUrl, coin, interval, Number.isFinite(days) ? days : DEFAULT_DAYS)

console.log(`Release smoke passed for ${baseUrl}`)

async function checkRoot(baseUrl) {
  const response = await fetch(baseUrl)
  if (!response.ok) {
    fail(`Root request failed with HTTP ${response.status}`)
  }
}

async function checkSnapshot(baseUrl, coin, interval) {
  const response = await fetch(
    `${baseUrl}/api/observatory-snapshot?${new URLSearchParams({ coin, interval }).toString()}`,
  )
  if (!response.ok) {
    fail(`Snapshot request failed with HTTP ${response.status}`)
  }

  const payload = await response.json()
  if (payload?.ok !== true || !payload.snapshot || !payload.priceContext) {
    fail('Snapshot payload is missing the observatory shell contract.')
  }
}

async function checkAnalytics(baseUrl, coin, interval, days) {
  const response = await fetch(
    `${baseUrl}/api/observatory-analytics?${new URLSearchParams({
      coin,
      interval,
      days: String(days),
    }).toString()}`,
  )
  if (!response.ok) {
    fail(`Analytics request failed with HTTP ${response.status}`)
  }

  const payload = await response.json()
  if (payload?.ok !== true || !payload.analytics) {
    fail('Analytics payload is missing the persisted ledger contract.')
  }
}

function parseArgs(argv) {
  const result = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (!arg?.startsWith('--')) continue
    const [rawKey, inlineValue] = arg.slice(2).split('=')
    const nextValue = inlineValue ?? argv[index + 1]
    const hasSeparateValue = inlineValue === undefined && nextValue && !nextValue.startsWith('--')
    result[rawKey] = hasSeparateValue ? nextValue : inlineValue ?? 'true'
    if (hasSeparateValue) {
      index += 1
    }
  }
  return result
}

function fail(message) {
  console.error(`\n[release-smoke] ${message}\n`)
  process.exit(1)
}

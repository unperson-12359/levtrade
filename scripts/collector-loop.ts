import { runCollector } from '../src/server/collector/runCollector'

const LOOP_MS = 5 * 60 * 1000
const MAX_JITTER_MS = 20 * 1000

async function main() {
  for (;;) {
    const startedAt = Date.now()

    try {
      const result = await runCollector(startedAt)
      const ok = result.results.filter((item) => item.ok).length
      const generated = result.results.filter((item) => item.setupGenerated).length
      const resolved = result.results.reduce((sum, item) => sum + item.outcomesResolved, 0)

      console.log(
        `[collector] ${new Date(startedAt).toISOString()} ok=${ok}/${result.results.length} generated=${generated} resolved=${resolved}`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Collector loop failed'
      console.error(`[collector] ${new Date(startedAt).toISOString()} ${message}`)
    }

    const jitter = Math.floor(Math.random() * MAX_JITTER_MS)
    await sleep(LOOP_MS + jitter)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Collector loop crashed'
  console.error(message)
  process.exitCode = 1
})

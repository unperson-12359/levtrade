import { runCollector } from '../src/server/collector/runCollector'

async function main() {
  const result = await runCollector()
  const ok = result.results.filter((item) => item.ok).length
  const failed = result.results.length - ok
  const generated = result.results.filter((item) => item.setupGenerated).length
  const resolved = result.results.reduce((sum, item) => sum + item.outcomesResolved, 0)

  console.log(
    JSON.stringify(
      {
        processedAt: new Date(result.processedAt).toISOString(),
        ok,
        failed,
        setupsGenerated: generated,
        outcomesResolved: resolved,
        results: result.results,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Collector failed'
  console.error(message)
  process.exitCode = 1
})

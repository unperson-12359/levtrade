import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')
const signoffPath = process.env.RELEASE_SIGNOFF_PATH ?? join(repoRoot, 'docs', 'release-signoff.md')
const verifyOnly = process.argv.includes('--verify-only')

if (!verifyOnly) {
  runCommand('npm run build')
  runCommand('npm run test:logic')
  runCommand('npm run test:e2e:critical')
}

verifySignoff(signoffPath)
console.log(`Release gate passed (${verifyOnly ? 'verify-only' : 'full'} mode).`)

function runCommand(command) {
  const result = spawnSync(command, {
    cwd: repoRoot,
    shell: true,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function verifySignoff(path) {
  if (!existsSync(path)) {
    fail(`Missing release signoff file: ${path}`)
  }

  const signoff = readFileSync(path, 'utf8')
  const requiredChecks = [
    /Status:\s*`?PASS`?/i,
    /- \[x\] Automated:\s*`?npm run build`?/i,
    /- \[x\] Automated:\s*`?npm run test:logic`?/i,
    /- \[x\] Automated:\s*`?npm run test:e2e:critical`?/i,
    /- \[x\] Manual:\s*Responsive matrix/i,
    /- \[x\] Manual:\s*10\+ minute production soak/i,
    /- \[x\] Manual:\s*Live shell continuity verification/i,
  ]

  for (const check of requiredChecks) {
    if (!check.test(signoff)) {
      fail(`Release signoff is incomplete (${check}). Update ${path} and re-run gate.`)
    }
  }
}

function fail(message) {
  console.error(`\n[release-gate] ${message}\n`)
  process.exit(1)
}

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')
const signoffPath = process.env.RELEASE_SIGNOFF_PATH ?? join(repoRoot, 'docs', 'release-signoff.md')
const verifyOnly = process.argv.includes('--verify-only')
const MAX_SIGNOFF_AGE_DAYS = 3

if (!verifyOnly) {
  runCommand('npm.cmd', ['run', 'build'])
  runCommand('npm.cmd', ['run', 'test:logic'])
  runCommand('npm.cmd', ['run', 'test:e2e:critical'])
}

verifySignoff(signoffPath)
console.log(`Release gate passed (${verifyOnly ? 'verify-only' : 'full'} mode).`)

function runCommand(file, args) {
  const result = process.platform === 'win32'
    ? spawnSync(
        'powershell.exe',
        ['-NoProfile', '-Command', buildPowerShellCommand(file, args)],
        {
          cwd: repoRoot,
          stdio: 'inherit',
        },
      )
    : spawnSync(file, args, {
        cwd: repoRoot,
        stdio: 'inherit',
      })

  if (result.error) {
    fail(`Unable to run ${file} ${args.join(' ')}: ${result.error.message}`)
  }

  if (result.status !== 0) {
    fail(`${file} ${args.join(' ')} exited with status ${result.status ?? 1}.`)
  }
}

function buildPowerShellCommand(file, args) {
  const parts = [file, ...args].map(quotePowerShell)
  return `& ${parts.join(' ')}`
}

function quotePowerShell(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function verifySignoff(path) {
  if (!existsSync(path)) {
    fail(`Missing release signoff file: ${path}`)
  }

  const signoff = readFileSync(path, 'utf8')
  const dateMatch = signoff.match(/- Date:\s*`?(\d{4}-\d{2}-\d{2})`?/i)
  const candidateMatch = signoff.match(/- Candidate:\s*`?([0-9a-f]{7,40})`?/i)

  if (!dateMatch) {
    fail(`Release signoff is missing a valid Date entry in ${path}.`)
  }
  if (!candidateMatch) {
    fail(`Release signoff is missing a valid Candidate hash in ${path}.`)
  }

  const ageDays = Math.floor((Date.now() - Date.parse(dateMatch[1])) / (24 * 60 * 60 * 1000))
  if (!Number.isFinite(ageDays) || ageDays < 0 || ageDays > MAX_SIGNOFF_AGE_DAYS) {
    fail(`Release signoff date is stale (${dateMatch[1]}). Update ${path} and re-run gate.`)
  }

  const acceptableCandidates = getAcceptableCandidates()
  if (!acceptableCandidates.includes(candidateMatch[1])) {
    fail(
      `Release signoff candidate ${candidateMatch[1]} does not match the current release candidate (${acceptableCandidates.join(' or ')}).`,
    )
  }

  const requiredChecks = [
    /Status:\s*`?PASS`?/i,
    /- \[x\] Automated:\s*`?npm run build`?/i,
    /- \[x\] Automated:\s*`?npm run test:logic`?/i,
    /- \[x\] Automated:\s*`?npm run test:e2e:critical`?/i,
    /- \[x\] Automated:\s*`?npm run smoke:release\b/i,
    /- \[x\] Manual:\s*Responsive matrix/i,
    /- \[x\] Manual:\s*Live shell continuity verification/i,
    /- \[x\] Manual:\s*Ledger freshness verification/i,
  ]

  for (const check of requiredChecks) {
    if (!check.test(signoff)) {
      fail(`Release signoff is incomplete (${check}). Update ${path} and re-run gate.`)
    }
  }
}

function getAcceptableCandidates() {
  const logPath = join(repoRoot, '.git', 'logs', 'HEAD')
  if (!existsSync(logPath)) {
    return []
  }

  const lines = readFileSync(logPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const latestLine = lines[lines.length - 1] ?? ''
  const match = latestLine.match(/^([0-9a-f]{40})\s+([0-9a-f]{40})\s+/i)
  if (!match) {
    return []
  }

  return [match[2].slice(0, 7), match[1].slice(0, 7)].filter(Boolean)
}

function fail(message) {
  console.error(`\n[release-gate] ${message}\n`)
  process.exit(1)
}

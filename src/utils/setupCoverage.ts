import type { SetupCoverageStatus, SetupOutcome, SetupWindow } from '../types/setup'

export function summarizeCoverage(
  outcomes: Record<SetupWindow, SetupOutcome>,
  current: SetupCoverageStatus | undefined,
): SetupCoverageStatus {
  const values = Object.values(outcomes).map((outcome) => outcome.coverageStatus).filter(Boolean) as SetupCoverageStatus[]
  if (values.includes('insufficient')) return 'insufficient'
  if (values.includes('partial')) return 'partial'
  return current ?? 'full'
}

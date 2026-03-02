// Shared formatters for setup-related metrics.
// Ensures consistent display of the same data across components.

export function formatRR(ratio: number): string {
  return `${ratio.toFixed(1)} : 1`
}

export function formatConfidence(confidence: number): string {
  return `${(confidence * 100).toFixed(0)}%`
}

export function formatTradeGrade(grade: string): string {
  return grade.toUpperCase()
}

export function formatEntryQuality(quality: string): string {
  return quality.replace('-', ' ').toUpperCase()
}

export function formatConfidenceTier(tier: string): string {
  return tier.toUpperCase()
}

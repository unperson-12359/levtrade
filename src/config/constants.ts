// Shared constants - single source of truth for magic numbers used across the app.

// Account defaults
export const DEFAULT_ACCOUNT_SIZE = 10_000

// History retention
export const SETUP_RETENTION_MS = 90 * 24 * 60 * 60 * 1000
export const TRACKER_RETENTION_MS = 90 * 24 * 60 * 60 * 1000

// Deduplication
export const SETUP_DEDUPE_WINDOW_MS = 4 * 60 * 60 * 1000
export const ENTRY_SIMILARITY_THRESHOLD = 0.02
export const TRACKER_DEDUPE_WINDOW_MS = 4 * 60 * 60 * 1000

// Time-series limits
export const MAX_FUNDING_HISTORY = 200
export const MAX_OI_HISTORY = 200

// Setup resolution
export const SETUP_RESOLUTION_INTERVAL = '1h'
export const SETUP_RESOLUTION_LOOKBACK_MS = 120 * 60 * 60 * 1000

// Polling
export const POLL_INTERVAL_MS = 60_000

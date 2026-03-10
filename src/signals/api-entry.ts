// Barrel export for API function bundling — do not import this from the frontend
export { TRACKED_COINS, parseCandle } from '../types/market'
export type { TrackedCoin, Candle, FundingSnapshot, OISnapshot, RawCandle, FundingHistoryEntry } from '../types/market'
export type { AssetSignals } from '../types/signals'
export type { SuggestedSetup } from '../types/setup'
export { computeHurst } from './hurst'
export { computeZScore } from './zscore'
export { computeFundingZScore } from './funding'
export { computeOIDelta } from './oiDelta'
export { computeATR, computeRealizedVol } from './volatility'
export { computeEntryGeometry } from './entryGeometry'
export { computeComposite } from './composite'
export { computeSuggestedSetup } from './setup'
export { computeSignalsAtTime, generateBackfillTimestamps } from './backfill'
export { computeProvisionalSetup } from './provisionalSetup'
export { computeSetupMetrics } from './setupMetrics'
export { computePositionPolicy } from './positionPolicy'
export { computeSuggestedPositionComposition, deriveCompositionRiskStatus } from './suggestedPosition'
export { resolveSetupWindow, emptyOutcome, SETUP_WINDOWS } from './resolveOutcome'
export { summarizeCoverage } from '../utils/setupCoverage'
export { buildSetupId } from '../utils/identity'
export type { SetupOutcome, SetupWindow, SetupCoverageStatus } from '../types/setup'
export { buildIndicatorStateRecords, buildObservatorySnapshot } from '../observatory/engine'
export { buildClosedIndicatorStateRecords, getClosedBarTimes } from '../observatory/persistence'
export type {
  IndicatorBarState,
  IndicatorHealth,
  IndicatorHealthWarning,
  IndicatorStateRecord,
  ObservatorySnapshot,
} from '../observatory/types'

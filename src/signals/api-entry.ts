// Barrel export for API function bundling. Do not import this from the frontend.
export { TRACKED_COINS, parseCandle } from '../types/market'
export type { Candle, RawCandle, TrackedCoin } from '../types/market'
export {
  buildIndicatorStateRecords,
  buildObservatorySnapshot,
} from '../observatory/engine'
export { buildPriceContext } from '../observatory/priceContext'
export {
  buildPersistedObservatoryAnalytics,
  type PersistedAnalyticsCategoryRow,
  type PersistedAnalyticsRow,
  type PersistedObservatoryAnalytics,
} from '../observatory/analytics'
export { OBSERVATORY_RULESET_VERSION } from '../observatory/version'
export {
  buildClosedIndicatorStateRecords,
  getClosedBarTimes,
} from '../observatory/persistence'
export type {
  IndicatorBarState,
  IndicatorHealth,
  IndicatorHealthWarning,
  IndicatorStateRecord,
  ObservatorySnapshot,
} from '../observatory/types'
export type { PriceContext } from '../observatory/priceContext'

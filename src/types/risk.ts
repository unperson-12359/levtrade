import type { TrackedCoin } from './market'
import type { SignalColor } from './signals'
import { DEFAULT_ACCOUNT_SIZE } from '../config/constants'

export type TradeDirection = 'long' | 'short'

export interface RiskInputs {
  coin: TrackedCoin
  direction: TradeDirection
  entryPrice: number
  accountSize: number
  positionSize: number        // margin (collateral) in USD
  leverage: number
  stopPrice: number | null    // user-set stop, null if not set
  targetPrice: number | null  // user-set target, null if not set
}

export interface RiskOutputs {
  // Liquidation
  liquidationPrice: number
  liquidationDistance: number      // % from entry
  hasLiquidation: boolean
  effectiveImmune: boolean
  minLeverageForLiquidation: number | null
  liquidationPriceAtMinLeverage: number | null
  liquidationDistanceAtMinLeverage: number | null
  liquidationFallbackExplanation: string | null
  hasInputError: boolean
  inputErrorMessage: string | null

  // Stop loss
  suggestedStopPrice: number      // 1.5x ATR
  effectiveStopPrice: number
  usedCustomStop: boolean
  stopValidationMessage: string | null
  lossAtStop: number              // USD
  lossAtStopPercent: number       // % of account

  // Target / reward
  suggestedTargetPrice: number    // 2:1 R:R from suggested stop
  effectiveTargetPrice: number
  usedCustomTarget: boolean
  targetValidationMessage: string | null
  profitAtTarget: number          // USD
  profitAtTargetPercent: number   // % of account

  // Ratios
  rrRatio: number                 // reward / risk

  // Position sizing
  notionalValue: number           // margin × leverage
  suggestedPositionSize: number   // margin for 1% account risk
  suggestedLeverage: number       // corresponding leverage

  // Overall grade
  tradeGrade: SignalColor
  tradeGradeLabel: string
  tradeGradeExplanation: string
}

export const DEFAULT_RISK_INPUTS: RiskInputs = {
  coin: 'BTC',
  direction: 'long',
  entryPrice: 0,
  accountSize: DEFAULT_ACCOUNT_SIZE,
  positionSize: 100,
  leverage: 5,
  stopPrice: null,
  targetPrice: null,
}

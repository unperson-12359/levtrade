import type { RiskInputs, RiskOutputs } from '../types/risk'
import type { SignalColor } from '../types/signals'

/**
 * Compute all risk metrics for a trade.
 *
 * Liquidation: cross-margin formula where entire account backs the position.
 * Stop suggestion: 1.5x ATR from entry
 * R:R ratio: distance to target / distance to stop
 */
export function computeRisk(inputs: RiskInputs, atr: number): RiskOutputs {
  const { direction, entryPrice, accountSize, positionSize, leverage, stopPrice, targetPrice } = inputs
  const hasPositionSizeInput = positionSize > 0

  if (entryPrice <= 0 || accountSize <= 0 || leverage <= 0) {
    return emptyOutputs()
  }

  if (stopPrice !== null && stopPrice === entryPrice) {
    return invalidInputOutputs('Stop cannot equal entry price.')
  }

  // --- Liquidation (cross-margin: entire account backs the position) ---
  const maintenanceMarginRate = 0.005 // 0.5% typical
  let liquidationPrice = 0
  let hasLiquidation = false
  let effectiveImmune = false
  let liquidationDistance = 0
  let liquidationFallback: ReturnType<typeof findMinimumLiquidationScenario> = null
  let liquidationFallbackExplanation: string | null = null

  if (hasPositionSizeInput) {
    const effectivePos = positionSize
    const marginUsed = effectivePos / leverage
    const availableMargin = accountSize - marginUsed
    const maintenanceMargin = effectivePos * maintenanceMarginRate
    const marginBuffer = availableMargin - maintenanceMargin

    if (marginBuffer <= 0) {
      liquidationPrice = entryPrice
    } else if (marginBuffer >= effectivePos) {
      liquidationPrice = direction === 'long' ? 0 : Infinity
    } else {
      liquidationPrice = direction === 'long'
        ? entryPrice * (1 - marginBuffer / effectivePos)
        : entryPrice * (1 + marginBuffer / effectivePos)
    }

    if (direction === 'long') {
      liquidationPrice = Math.max(0, liquidationPrice)
    }

    hasLiquidation = Number.isFinite(liquidationPrice) && liquidationPrice > 0
    effectiveImmune = !hasLiquidation
    liquidationDistance = liquidationPrice === Infinity || liquidationPrice <= 0
      ? 100
      : Math.abs(liquidationPrice - entryPrice) / entryPrice * 100
    liquidationFallback = effectiveImmune ? findMinimumLiquidationScenario(inputs) : null
    liquidationFallbackExplanation = liquidationFallback?.explanation ?? null
  } else {
    liquidationFallbackExplanation = 'Enter a position size to calculate liquidation.'
  }

  // --- Suggested Stop (1.5x ATR) ---
  const atrStop = atr > 0 ? atr * 1.5 : entryPrice * 0.02 // fallback: 2%
  const suggestedStopPrice =
    direction === 'long'
      ? entryPrice - atrStop
      : entryPrice + atrStop

  const stopValidationMessage = validateStop(direction, entryPrice, stopPrice)
  const usedCustomStop = stopPrice !== null && stopValidationMessage === null
  const effectiveStopPrice = usedCustomStop ? stopPrice! : suggestedStopPrice
  const stopDistance = Math.abs(entryPrice - effectiveStopPrice)

  // --- Loss at Stop ---
  const effectivePositionSize = positionSize > 0 ? positionSize : accountSize * leverage
  const lossAtStop = effectivePositionSize * (stopDistance / entryPrice)
  const lossAtStopPercent = accountSize > 0 ? (lossAtStop / accountSize) * 100 : 0

  // --- Target (2:1 R:R from stop, or user-specified) ---
  const suggestedTargetPrice =
    direction === 'long'
      ? entryPrice + stopDistance * 2
      : entryPrice - stopDistance * 2

  const targetValidationMessage = validateTarget(direction, entryPrice, targetPrice)
  const usedCustomTarget = targetPrice !== null && targetValidationMessage === null
  const effectiveTargetPrice = usedCustomTarget ? targetPrice! : suggestedTargetPrice
  const targetDistance = Math.abs(effectiveTargetPrice - entryPrice)
  const profitAtTarget = effectivePositionSize * (targetDistance / entryPrice)
  const profitAtTargetPercent = accountSize > 0 ? (profitAtTarget / accountSize) * 100 : 0

  // --- Reward/Risk Ratio ---
  const rrRatio = stopDistance > 0 ? targetDistance / stopDistance : 0

  // --- Suggested Position Size (1% account risk) ---
  const riskPerUnit = stopDistance / entryPrice
  const suggestedPositionSize = riskPerUnit > 0
    ? (accountSize * 0.01) / riskPerUnit
    : 0
  const suggestedLeverage = entryPrice > 0
    ? suggestedPositionSize / (accountSize > 0 ? accountSize : 1)
    : 1

  // --- Trade Grade ---
  const { tradeGrade, tradeGradeLabel, tradeGradeExplanation } = gradeTradeSetup({
    liquidationDistance,
    lossAtStopPercent,
    rrRatio,
    leverage,
    stopDistance,
    atr,
    entryPrice,
  })

  return {
    liquidationPrice,
    liquidationDistance,
    hasLiquidation,
    effectiveImmune,
    minLeverageForLiquidation: liquidationFallback?.leverage ?? null,
    liquidationPriceAtMinLeverage: liquidationFallback?.price ?? null,
    liquidationDistanceAtMinLeverage: liquidationFallback?.distancePct ?? null,
    liquidationFallbackExplanation,
    hasInputError: false,
    inputErrorMessage: null,
    suggestedStopPrice,
    effectiveStopPrice,
    usedCustomStop,
    stopValidationMessage,
    lossAtStop,
    lossAtStopPercent,
    suggestedTargetPrice,
    effectiveTargetPrice,
    usedCustomTarget,
    targetValidationMessage,
    profitAtTarget,
    profitAtTargetPercent,
    rrRatio,
    suggestedPositionSize,
    suggestedLeverage,
    tradeGrade,
    tradeGradeLabel,
    tradeGradeExplanation,
  }
}

interface GradeInput {
  liquidationDistance: number
  lossAtStopPercent: number
  rrRatio: number
  leverage: number
  stopDistance: number
  atr: number
  entryPrice: number
}

function gradeTradeSetup(input: GradeInput): {
  tradeGrade: SignalColor
  tradeGradeLabel: string
  tradeGradeExplanation: string
} {
  const issues: string[] = []
  let score = 0

  // Liquidation distance check (cross-margin can produce 100%+ distances)
  if (input.liquidationDistance >= 100) score += 2
  else if (input.liquidationDistance > 20) score += 2
  else if (input.liquidationDistance > 10) score += 1
  else {
    issues.push(`Liquidation is only ${input.liquidationDistance.toFixed(1)}% away — very tight`)
  }

  // Loss at stop check
  if (input.lossAtStopPercent < 1) score += 2
  else if (input.lossAtStopPercent < 2) score += 1
  else if (input.lossAtStopPercent < 5) {
    issues.push(`Risking ${input.lossAtStopPercent.toFixed(1)}% of your account — consider reducing size`)
  } else {
    issues.push(`Risking ${input.lossAtStopPercent.toFixed(1)}% of your account — that's too much`)
  }

  // R:R check
  if (input.rrRatio >= 3) score += 2
  else if (input.rrRatio >= 2) score += 1
  else if (input.rrRatio >= 1) {
    issues.push(`R:R of ${input.rrRatio.toFixed(1)}:1 is borderline — look for 2:1 minimum`)
  } else {
    issues.push(`R:R of ${input.rrRatio.toFixed(1)}:1 — the reward doesn't justify the risk`)
  }

  // Leverage check
  if (input.leverage <= 5) score += 1
  else if (input.leverage <= 10) { /* neutral */ }
  else if (input.leverage <= 20) {
    issues.push(`Leverage of ${input.leverage}x is aggressive`)
  } else {
    issues.push(`Leverage of ${input.leverage}x is very high — small moves can liquidate you`)
  }

  // Stop vs ATR check
  if (input.atr > 0) {
    const stopInATR = input.stopDistance / input.atr
    if (stopInATR < 1) {
      issues.push('Stop is within normal price noise — it will likely get hit randomly')
    }
  }

  // Grade
  let tradeGrade: SignalColor
  let tradeGradeLabel: string

  if (score >= 5 && issues.length === 0) {
    tradeGrade = 'green'
    tradeGradeLabel = 'GOOD SETUP'
  } else if (score >= 3 && issues.length <= 1) {
    tradeGrade = 'yellow'
    tradeGradeLabel = 'BORDERLINE'
  } else {
    tradeGrade = 'red'
    tradeGradeLabel = 'TOO RISKY'
  }

  const tradeGradeExplanation = issues.length > 0
    ? `${tradeGradeLabel} — ${issues.join('. ')}.`
    : `${tradeGradeLabel} — R:R is favorable, stop is in a safe zone, and leverage is reasonable.`

  return { tradeGrade, tradeGradeLabel, tradeGradeExplanation }
}

function emptyOutputs(): RiskOutputs {
  return {
    liquidationPrice: 0,
    liquidationDistance: 0,
    hasLiquidation: false,
    effectiveImmune: true,
    minLeverageForLiquidation: null,
    liquidationPriceAtMinLeverage: null,
    liquidationDistanceAtMinLeverage: null,
    liquidationFallbackExplanation: null,
    hasInputError: false,
    inputErrorMessage: null,
    suggestedStopPrice: 0,
    effectiveStopPrice: 0,
    usedCustomStop: false,
    stopValidationMessage: null,
    lossAtStop: 0,
    lossAtStopPercent: 0,
    suggestedTargetPrice: 0,
    effectiveTargetPrice: 0,
    usedCustomTarget: false,
    targetValidationMessage: null,
    profitAtTarget: 0,
    profitAtTargetPercent: 0,
    rrRatio: 0,
    suggestedPositionSize: 0,
    suggestedLeverage: 0,
    tradeGrade: 'yellow',
    tradeGradeLabel: 'ENTER PARAMETERS',
    tradeGradeExplanation: 'Fill in the form to see your risk analysis.',
  }
}

function invalidInputOutputs(message: string): RiskOutputs {
  return {
    liquidationPrice: 0,
    liquidationDistance: 0,
    hasLiquidation: false,
    effectiveImmune: true,
    minLeverageForLiquidation: null,
    liquidationPriceAtMinLeverage: null,
    liquidationDistanceAtMinLeverage: null,
    liquidationFallbackExplanation: null,
    hasInputError: true,
    inputErrorMessage: message,
    suggestedStopPrice: 0,
    effectiveStopPrice: 0,
    usedCustomStop: false,
    stopValidationMessage: null,
    lossAtStop: 0,
    lossAtStopPercent: 0,
    suggestedTargetPrice: 0,
    effectiveTargetPrice: 0,
    usedCustomTarget: false,
    targetValidationMessage: null,
    profitAtTarget: 0,
    profitAtTargetPercent: 0,
    rrRatio: 0,
    suggestedPositionSize: 0,
    suggestedLeverage: 0,
    tradeGrade: 'red',
    tradeGradeLabel: 'INVALID INPUT',
    tradeGradeExplanation: 'Stop cannot equal entry price. Move the stop away from entry to calculate risk.',
  }
}

function findMinimumLiquidationScenario(inputs: RiskInputs): {
  leverage: number
  price: number
  distancePct: number
  explanation: string
} | null {
  for (let testLeverage = 1; testLeverage <= 100; testLeverage += 0.5) {
    const liquidationPrice = computeLiquidationPrice({
      ...inputs,
      leverage: testLeverage,
    })
    const hasLiquidation = Number.isFinite(liquidationPrice) && liquidationPrice > 0

    if (hasLiquidation) {
      const distancePct = Math.abs(liquidationPrice - inputs.entryPrice) / inputs.entryPrice * 100
      return {
        leverage: testLeverage,
        price: liquidationPrice,
        distancePct,
        explanation: `Liquidation first appears around ${testLeverage.toFixed(1)}x, where the liquidation level would be ${liquidationPrice.toFixed(2)}.`,
      }
    }
  }

  return null
}

function computeLiquidationPrice(inputs: Pick<RiskInputs, 'direction' | 'entryPrice' | 'accountSize' | 'positionSize' | 'leverage'>): number {
  const { direction, entryPrice, accountSize, positionSize, leverage } = inputs
  const maintenanceMarginRate = 0.005
  const effectivePos = positionSize > 0 ? positionSize : accountSize * leverage
  const marginUsed = effectivePos / leverage
  const availableMargin = accountSize - marginUsed
  const maintenanceMargin = effectivePos * maintenanceMarginRate
  const marginBuffer = availableMargin - maintenanceMargin

  let liquidationPrice: number
  if (marginBuffer <= 0) {
    liquidationPrice = entryPrice
  } else if (marginBuffer >= effectivePos) {
    liquidationPrice = direction === 'long' ? 0 : Infinity
  } else {
    liquidationPrice = direction === 'long'
      ? entryPrice * (1 - marginBuffer / effectivePos)
      : entryPrice * (1 + marginBuffer / effectivePos)
  }

  return direction === 'long' ? Math.max(0, liquidationPrice) : liquidationPrice
}

function validateStop(direction: RiskInputs['direction'], entryPrice: number, stopPrice: number | null): string | null {
  if (stopPrice === null) return null
  if (direction === 'long' && stopPrice >= entryPrice) {
    return 'Long stops must stay below entry, so auto stop is being used instead.'
  }
  if (direction === 'short' && stopPrice <= entryPrice) {
    return 'Short stops must stay above entry, so auto stop is being used instead.'
  }
  return null
}

function validateTarget(direction: RiskInputs['direction'], entryPrice: number, targetPrice: number | null): string | null {
  if (targetPrice === null) return null
  if (direction === 'long' && targetPrice <= entryPrice) {
    return 'Long targets must stay above entry, so auto target is being used instead.'
  }
  if (direction === 'short' && targetPrice >= entryPrice) {
    return 'Short targets must stay below entry, so auto target is being used instead.'
  }
  return null
}

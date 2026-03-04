import type { TrackedCoin } from '../types/market'
import type { SuggestedPositionComposition } from '../types/position'
import type { RiskOutputs } from '../types/risk'
import type { AssetSignals, DecisionAction, RiskStatus, SignalColor } from '../types/signals'

export const WORKFLOW_STEPS = {
  1: {
    title: 'MARKET CHECK',
    question: 'Can I use this mean-reversion strategy in this market?',
  },
  2: {
    title: 'ENTRY CHECK',
    question: 'Is there a real entry right now?',
  },
  3: {
    title: 'POSITION COMPOSITION',
    question: 'If I take it, what account-sized composition is safe enough?',
  },
} as const

export interface EntryDecisionSnapshot {
  action: DecisionAction
  label: string
  reasons: string[]
  color: SignalColor
  riskStatus: RiskStatus
}

export interface WorkflowGuidance {
  tone: SignalColor
  label: string
  summary: string
  action: string
  nextStep: string
  canProceed: boolean
}

export interface HeroGuidance {
  tone: SignalColor
  badge: string
  title: string
  summary: string
  action: string
  nextStep: string
  bullets: string[]
}

export type WorkflowVisualState = 'pass' | 'fail' | 'wait'
export type WorkflowAccessState = 'current' | 'unlocked' | 'locked'
export type WorkflowStepStatus = 'active' | 'done' | 'pending'

export interface WorkflowStepState {
  step: 1 | 2 | 3
  title: string
  question: string
  status: WorkflowStepStatus
  state: WorkflowVisualState
  access: WorkflowAccessState
  tone: SignalColor
  label: string
  detail: string
  nextInstruction: string
  successRule: string
  isActionable: boolean
  isCurrentFocus: boolean
}

export type MethodologyStepState = WorkflowStepState

export function getMarketWorkflowGuidance(signals: AssetSignals | null | undefined): WorkflowGuidance {
  if (!signals) {
    return {
      tone: 'yellow',
      label: 'LOADING',
      summary: 'Waiting for market data before judging whether this strategy fits the current conditions.',
      action: 'Do not make a trade decision yet.',
      nextStep: 'Wait for the dashboard to finish loading, then start with this step.',
      canProceed: false,
    }
  }

  if (signals.isStale) {
    return {
      tone: 'red',
      label: 'RECHECK DATA',
      summary: 'The feed is stale, so the market read may be outdated.',
      action: 'Refresh or wait for fresh data before trusting this dashboard.',
      nextStep: 'Only continue when the stale warning is gone.',
      canProceed: false,
    }
  }

  if (signals.isWarmingUp) {
    return {
      tone: 'yellow',
      label: 'WARMING UP',
      summary: 'The model is still building enough history to judge the market reliably.',
      action: 'Wait for warmup to finish before looking for entries.',
      nextStep: 'Only continue when this step turns FAVORABLE.',
      canProceed: false,
    }
  }

  switch (signals.hurst.regime) {
    case 'mean-reverting':
      return {
        tone: 'green',
        label: 'FAVORABLE',
        summary: 'This market is bouncing around enough for mean-reversion setups to make sense.',
        action: 'Continue to Step 2 and see if there is an entry right now.',
        nextStep: 'Only continue if Step 2 also shows a live setup.',
        canProceed: true,
      }
    case 'choppy':
      return {
        tone: 'yellow',
        label: 'UNRELIABLE',
        summary: 'This market is messy and inconsistent. Signals can appear and disappear quickly.',
        action: 'Treat signals with caution and prefer waiting for cleaner conditions.',
        nextStep: 'Only continue if Step 2 becomes unusually strong and risk stays conservative.',
        canProceed: false,
      }
    case 'trending':
      return {
        tone: 'red',
        label: 'UNFAVORABLE',
        summary: 'This market is trending, which fights the mean-reversion strategy this dashboard is built around.',
        action: 'Do not take a mean-reversion trade right now.',
        nextStep: 'Wait until the market becomes range-bound again.',
        canProceed: false,
      }
  }
}

export function getEntryWorkflowGuidance(
  signals: AssetSignals | null | undefined,
  decision: EntryDecisionSnapshot,
  market: WorkflowGuidance,
): WorkflowGuidance & {
  directionLabel: 'LONG' | 'SHORT' | 'NONE'
  waitFor: string
  reasons: string[]
} {
  if (!signals) {
    return {
      tone: 'yellow',
      label: 'WAITING',
      summary: 'Signals are still loading, so there is no entry call yet.',
      action: 'Wait for the signal engine to finish loading.',
      nextStep: 'Come back to this step once the dashboard is live.',
      canProceed: false,
      directionLabel: 'NONE',
      waitFor: 'Fresh signal data.',
      reasons: [],
    }
  }

  if (!market.canProceed) {
    return {
      tone: 'yellow',
      label: 'LOCKED',
      summary: 'Do not hunt for an entry until Step 1 says the market is favorable for this strategy.',
      action: 'Pause here. A bad market can invalidate even a pretty-looking signal.',
      nextStep: 'Wait for Step 1 to turn FAVORABLE first.',
      canProceed: false,
      directionLabel: 'NONE',
      waitFor: market.nextStep,
      reasons: [],
    }
  }

  const directionLabel = signals.composite.direction === 'long'
    ? 'LONG'
    : signals.composite.direction === 'short'
      ? 'SHORT'
      : 'NONE'
  const geometrySupportsDirection = (
    (signals.composite.direction === 'long' && signals.entryGeometry.directionBias === 'long') ||
    (signals.composite.direction === 'short' && signals.entryGeometry.directionBias === 'short')
  )
  const geometryStrong = signals.entryGeometry.entryQuality === 'ideal' || signals.entryGeometry.entryQuality === 'extended'
  const filteredReasons = decision.reasons
    .filter((reason) => reason !== 'risk too large' && reason !== 'risk tight')
    .map(humanizeReason)

  if ((signals.composite.direction === 'long' || signals.composite.direction === 'short') && geometrySupportsDirection && geometryStrong) {
    return {
      tone: 'green',
      label: 'ENTRY VALID',
      summary: `Signals and price stretch are lined up for a ${directionLabel.toLowerCase()} setup right now.`,
      action: 'Move to Step 3 and review the account-sized position composition.',
      nextStep: 'Only enter after Step 3 says the composition is safe enough.',
      canProceed: true,
      directionLabel,
      waitFor: 'A safe account-sized composition in Step 3.',
      reasons: filteredReasons,
    }
  }

  if (signals.composite.direction === 'neutral' || signals.composite.strength === 'weak') {
    return {
      tone: 'yellow',
      label: 'NO ENTRY',
      summary: 'Signals are mixed right now, so there is no clean directional edge.',
      action: 'Wait for more agreement between price stretch, funding, and money flow.',
      nextStep: 'Come back when direction is clear and the setup becomes stronger.',
      canProceed: false,
      directionLabel: 'NONE',
      waitFor: 'Clearer signal agreement.',
      reasons: filteredReasons,
    }
  }

  if (signals.entryGeometry.entryQuality === 'early') {
    return {
      tone: 'yellow',
      label: 'EARLY',
      summary: 'The idea is forming, but price has not stretched enough from its average yet.',
      action: 'Wait for a better stretch before considering the trade.',
      nextStep: 'You want a clearer dislocation before entering.',
      canProceed: false,
      directionLabel,
      waitFor: 'More stretch away from the average.',
      reasons: filteredReasons,
    }
  }

  if (signals.entryGeometry.entryQuality === 'chasing') {
    return {
      tone: 'red',
      label: 'NO ENTRY',
      summary: 'The move has already run too far or snapped back too much. This is now a chase, not a clean entry.',
      action: 'Wait for a fresh setup instead of forcing this trade.',
      nextStep: 'Look for a new stretch from the mean.',
      canProceed: false,
      directionLabel,
      waitFor: 'A new, cleaner setup.',
      reasons: filteredReasons,
    }
  }

  return {
    tone: 'yellow',
    label: 'WATCH',
    summary: 'There is some signal alignment, but it is not strong enough yet for a confident entry.',
    action: 'Keep watching, but do not act until the setup becomes clearer.',
    nextStep: 'Wait for stronger agreement or better price stretch.',
    canProceed: false,
    directionLabel,
    waitFor: 'Stronger alignment and cleaner stretch.',
    reasons: filteredReasons,
  }
}

export function getRiskWorkflowGuidance(
  outputs: RiskOutputs | null | undefined,
  riskStatus: RiskStatus,
  entry: WorkflowGuidance,
): WorkflowGuidance {
  if (outputs?.hasInputError) {
    return {
      tone: 'red',
      label: 'FIX INPUTS',
      summary: outputs.inputErrorMessage ?? 'One of the risk inputs is invalid.',
      action: 'Fix the highlighted input before trusting the composition or liquidation numbers.',
      nextStep: 'Then re-check whether the trade is still worth taking.',
      canProceed: false,
    }
  }

  if (!entry.canProceed) {
    return {
      tone: 'yellow',
      label: 'PENDING',
      summary: 'Only compose a trade here after Step 2 says there is a real entry.',
      action: 'Use this section after Steps 1 and 2 are both green to confirm the account-sized composition.',
      nextStep: 'Come back here once the setup is valid.',
      canProceed: false,
    }
  }

  if (!outputs) {
    return {
      tone: 'yellow',
      label: 'NOT SIZED',
      summary: 'You still need to enter account capital before LevTrade can finalize the position composition.',
      action: 'Set your account capital in Step 3 to size the current setup automatically.',
      nextStep: 'Only enter once this section says SAFE ENOUGH.',
      canProceed: false,
    }
  }

  if (riskStatus === 'safe' && outputs.tradeGrade === 'green') {
    return {
      tone: 'green',
      label: 'SAFE ENOUGH',
      summary: outputs.tradeGradeExplanation,
      action: 'If you take the trade, use the suggested size and respect the stop.',
      nextStep: 'Only proceed if you are comfortable with the loss at stop.',
      canProceed: true,
    }
  }

  if (riskStatus === 'borderline' || outputs.tradeGrade === 'yellow') {
    return {
      tone: 'yellow',
      label: 'REDUCE SIZE',
      summary: outputs.tradeGradeExplanation,
      action: 'Reduce leverage or margin size before entering.',
      nextStep: 'You want a wider buffer before liquidation and a smaller capital hit at stop.',
      canProceed: false,
    }
  }

  return {
    tone: 'red',
    label: 'DO NOT TAKE',
    summary: outputs.tradeGradeExplanation,
    action: 'Do not enter unless you materially reduce the risk.',
    nextStep: 'Lower margin, widen the stop, or wait for a better setup.',
    canProceed: false,
  }
}

export function getDecisionHeroGuidance(
  coin: TrackedCoin,
  signals: AssetSignals | null | undefined,
  decision: EntryDecisionSnapshot,
  outputs: RiskOutputs | null | undefined,
  riskStatus: RiskStatus,
): HeroGuidance {
  const market = getMarketWorkflowGuidance(signals)
  const entry = getEntryWorkflowGuidance(signals, decision, market)
  const risk = getRiskWorkflowGuidance(outputs, riskStatus, entry)

  if (!signals) {
    return {
      tone: 'yellow',
      badge: 'LOADING',
      title: `Checking ${coin}`,
      summary: 'The dashboard is still pulling data, so there is nothing actionable yet.',
      action: 'Wait for the market and signal sections to populate.',
      nextStep: 'Start with Step 1 once the loading state clears.',
      bullets: [],
    }
  }

  if (!market.canProceed) {
    return {
      tone: market.tone,
      badge: market.label,
      title: market.tone === 'red' ? 'DO NOT TRADE THIS NOW' : 'WAIT FOR A BETTER MARKET',
      summary: market.summary,
      action: market.action,
      nextStep: market.nextStep,
      bullets: [market.label, signals.hurst.regime.replace('-', ' '), ...entry.reasons.slice(0, 2)],
    }
  }

  if (!entry.canProceed) {
    return {
      tone: entry.tone,
      badge: entry.label,
      title: 'WAIT FOR A BETTER ENTRY',
      summary: entry.summary,
      action: entry.action,
      nextStep: entry.waitFor,
      bullets: entry.reasons.slice(0, 3),
    }
  }

  if (!risk.canProceed) {
    return {
      tone: risk.tone,
      badge: risk.label,
      title: 'TRADE IS POSSIBLE, CHECK COMPOSITION',
      summary: entry.summary,
      action: risk.action,
      nextStep: risk.nextStep,
      bullets: [
        `${entry.directionLabel} setup`,
        ...entry.reasons.slice(0, 2),
        risk.label.toLowerCase(),
      ],
    }
  }

  return {
    tone: 'green',
    badge: 'READY',
    title: 'SETUP IS VALID',
    summary: `${entry.summary} ${risk.summary}`,
    action: 'If you take it, use the risk plan shown in Step 3 and respect the stop.',
    nextStep: 'The only remaining decision is whether you personally want to take the trade.',
    bullets: [
      `${entry.directionLabel} setup`,
      ...entry.reasons.slice(0, 2),
      risk.label.toLowerCase(),
    ],
  }
}

export function getWorkflowStepStates(
  signals: AssetSignals | null | undefined,
  decision: EntryDecisionSnapshot,
  outputs: RiskOutputs | null | undefined,
  riskStatus: RiskStatus,
  composition?: SuggestedPositionComposition | null,
): [WorkflowStepState, WorkflowStepState, WorkflowStepState] {
  const market = getMarketWorkflowGuidance(signals)
  const entry = getEntryWorkflowGuidance(signals, decision, market)
  const risk = getRiskWorkflowGuidance(outputs, riskStatus, entry)
  const step1State = resolveVisualState(market)
  const step2Unlocked = step1State === 'pass'
  const step2State = step2Unlocked ? resolveVisualState(entry) : 'wait'
  const step3Presentation = resolveStep3Presentation({
    composition,
    risk,
    step2Passed: step2State === 'pass',
  })

  const step1 = buildWorkflowStepState({
    step: 1,
    state: step1State,
    access: step1State === 'pass' ? 'unlocked' : 'current',
    tone: market.tone,
    label: market.label,
    detail: market.summary,
    nextInstruction: market.canProceed ? 'Step 2 is now unlocked.' : market.action,
    successRule: market.canProceed
      ? 'Step 1 passed. You can now judge whether there is a live entry.'
      : 'Only continue when this step turns FAVORABLE.',
  })

  const step2 = step2Unlocked
    ? buildWorkflowStepState({
        step: 2,
        state: step2State,
        access: step2State === 'pass' ? 'unlocked' : 'current',
        tone: entry.tone,
        label: entry.label,
        detail: entry.summary,
        nextInstruction: entry.canProceed ? 'Step 3 is now unlocked.' : entry.waitFor,
        successRule: entry.canProceed
          ? 'Step 2 passed. You can now size the setup in Step 3.'
          : 'Only continue when there is a real entry right now.',
      })
    : buildWorkflowStepState({
        step: 2,
        state: 'wait',
        access: 'locked',
        tone: 'yellow',
        label: 'LOCKED',
        detail: 'Step 1 has not passed yet, so the entry check is not actionable.',
        nextInstruction: 'Wait for Step 1 to turn green before judging the entry.',
        successRule: 'Step 2 unlocks only after Step 1 passes.',
      })

  const step3 = step3Presentation.unlocked
    ? buildWorkflowStepState({
        step: 3,
        state: step3Presentation.state,
        access: step3Presentation.state === 'pass' ? 'unlocked' : 'current',
        tone: step3Presentation.tone,
        label: step3Presentation.label,
        detail: step3Presentation.detail,
        nextInstruction: step3Presentation.nextInstruction,
        successRule: step3Presentation.successRule,
      })
    : buildWorkflowStepState({
        step: 3,
        state: 'wait',
        access: 'locked',
        tone: 'yellow',
        label: 'LOCKED',
        detail: 'LevTrade will light up Step 3 once there is enough directional structure to size a real or draft composition.',
        nextInstruction: 'Wait for Step 2 confirmation or for a provisional draft to appear.',
        successRule: 'Step 3 becomes actionable only when LevTrade can size the trade.',
      })

  return [step1, step2, step3]
}

export function getMethodologySteps(
  signals: AssetSignals | null | undefined,
  decision: EntryDecisionSnapshot,
  outputs: RiskOutputs | null | undefined,
  riskStatus: RiskStatus,
  composition?: SuggestedPositionComposition | null,
): [MethodologyStepState, MethodologyStepState, MethodologyStepState] {
  return getWorkflowStepStates(signals, decision, outputs, riskStatus, composition)
}

function humanizeReason(reason: string): string {
  switch (reason) {
    case 'stale feed':
      return 'live data is stale'
    case 'refresh needed':
      return 'wait for fresh data'
    case 'warming up':
      return 'the model is still warming up'
    case 'signals incomplete':
      return 'not enough history yet'
    case 'trend veto':
      return 'the market is trending against this strategy'
    case 'mixed signals':
      return 'the signals do not agree yet'
    case 'no stretch':
      return 'price is not stretched enough from average'
    case 'risk too large':
      return 'the position is too aggressive'
    case 'risk tight':
      return 'risk is workable but tight'
    case 'signals aligned':
      return 'the signals are lining up'
    case 'partial agreement':
      return 'some signals agree, but not all'
    case 'mean-reverting regime':
      return 'the market is acting range-bound'
    case 'regime acceptable':
      return 'market conditions are acceptable'
    default:
      return reason
  }
}

function resolveVisualState(guidance: WorkflowGuidance): WorkflowVisualState {
  if (guidance.canProceed) {
    return 'pass'
  }
  return guidance.tone === 'red' ? 'fail' : 'wait'
}

function resolveStepStatus(state: WorkflowVisualState, access: WorkflowAccessState): WorkflowStepStatus {
  if (access === 'locked') {
    return 'pending'
  }
  return state === 'pass' ? 'done' : 'active'
}

function buildWorkflowStepState({
  step,
  state,
  access,
  tone,
  label,
  detail,
  nextInstruction,
  successRule,
}: {
  step: 1 | 2 | 3
  state: WorkflowVisualState
  access: WorkflowAccessState
  tone: SignalColor
  label: string
  detail: string
  nextInstruction: string
  successRule: string
}): WorkflowStepState {
  return {
    step,
    title: WORKFLOW_STEPS[step].title,
    question: WORKFLOW_STEPS[step].question,
    status: resolveStepStatus(state, access),
    state,
    access,
    tone,
    label,
    detail,
    nextInstruction,
    successRule,
    isActionable: access === 'current',
    isCurrentFocus: access === 'current',
  }
}

function resolveStep3Presentation({
  composition,
  risk,
  step2Passed,
}: {
  composition?: SuggestedPositionComposition | null
  risk: WorkflowGuidance
  step2Passed: boolean
}): {
  unlocked: boolean
  state: WorkflowVisualState
  tone: SignalColor
  label: string
  detail: string
  nextInstruction: string
  successRule: string
} {
  if (!composition || composition.mode === 'none' || composition.status === 'none') {
    return {
      unlocked: false,
      state: 'wait',
      tone: 'yellow',
      label: 'LOCKED',
      detail: 'LevTrade is waiting for enough directional structure before it can size this trade.',
      nextInstruction: 'Wait for Step 2 confirmation or a provisional draft composition.',
      successRule: 'This step unlocks only when a composition is available.',
    }
  }

  if (composition.mode === 'provisional') {
    if (composition.status === 'invalid') {
      return {
        unlocked: true,
        state: 'wait',
        tone: 'yellow',
        label: 'NOT SIZED',
        detail: 'A reduced-risk draft exists, but you still need account capital before LevTrade can finish the provisional composition.',
        nextInstruction: 'Enter account capital to size the draft, then wait for Step 2 confirmation before treating it as green.',
        successRule: 'This stays yellow until Step 2 confirms the setup and the composition is safe enough.',
      }
    }

    const provisionalIsDanger = composition.outputs?.tradeGrade === 'red'

    return {
      unlocked: true,
      state: provisionalIsDanger ? 'fail' : 'wait',
      tone: provisionalIsDanger ? 'red' : 'yellow',
      label: provisionalIsDanger ? 'DO NOT TAKE' : 'DRAFT ONLY',
      detail: provisionalIsDanger
        ? composition.outputs?.tradeGradeExplanation ?? 'The provisional draft is still too risky to act on.'
        : 'LevTrade can draft a reduced-risk composition here, but Step 2 has not fully confirmed the setup yet.',
      nextInstruction: provisionalIsDanger
        ? 'Wait for a better setup or materially reduce the risk before acting on the draft.'
        : 'Treat this as a caution draft until Step 2 turns green.',
      successRule: 'Step 3 turns green only after Step 2 confirms the setup and the composition stays safe enough.',
    }
  }

  return {
    unlocked: true,
    state: resolveVisualState(risk),
    tone: risk.tone,
    label: risk.label,
    detail: risk.summary,
    nextInstruction: risk.canProceed
      ? 'The setup is fully qualified.'
      : risk.nextStep,
    successRule: risk.canProceed
      ? (step2Passed
        ? 'All three steps are green. The setup is ready if you want to take it.'
        : 'The composition is safe enough, but Step 2 still needs confirmation.')
      : 'Only trade when the proposed composition is safe enough.',
  }
}

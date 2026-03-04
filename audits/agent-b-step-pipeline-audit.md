# Agent B — Step 1 to Step 3 Pipeline Audit

## Goal
Audit the current Step 1 -> Step 3 workflow for logic drift, stale semantics, and source-of-truth confusion.

## Files inspected
- `src/hooks/useSignals.ts`
- `src/hooks/useEntryDecision.ts`
- `src/hooks/useSuggestedSetup.ts`
- `src/hooks/useSuggestedPosition.ts`
- `src/hooks/usePositionRisk.ts`
- `src/signals/decision.ts`
- `src/signals/setup.ts`
- `src/signals/provisionalSetup.ts`
- `src/signals/positionPolicy.ts`
- `src/signals/risk.ts`
- `src/utils/workflowGuidance.ts`
- `src/components/decision/DecisionHero.tsx`
- `src/components/market/MarketRail.tsx`
- `src/components/signal/SignalSection.tsx`
- `src/components/risk/RiskForm.tsx`
- `src/components/risk/RiskResults.tsx`

## Current behavior
- Step 1 is market gating.
- Step 2 is entry validation and setup generation.
- Step 3 is automatic account-sized position composition, not manual geometry entry.
- Provisional composition is allowed when setup confirmation is weak but directional structure exists.

## Expected behavior
- Step 1 should gate Step 2.
- Step 2 should gate Step 3.
- Step 3 should never feed back into Step 1 or Step 2 in a way that changes the signal decision.

## Findings
1. The primary trading pipeline is mostly one-way now.
   - `useEntryDecision()` is signal-only and no longer reads account-sized risk.
   - `useSuggestedPosition()` derives Step 3 from Step 2 output plus account capital.
2. Workflow language still carries legacy Step 3 semantics.
   - `WORKFLOW_STEPS[3]` in `src/utils/workflowGuidance.ts` is still titled `RISK CHECK`, while the UI surface says `Position composition`.
   - This is terminology drift, not computational drift.
3. Tracker-side decision snapshots still use legacy manual risk inputs.
   - `trackAllDecisionSnapshots()` in `src/store/trackerSlice.ts` computes `globalRiskStatus` from `state.riskInputs`.
   - Step 3 no longer uses those legacy geometry inputs directly.
   - This creates analytics drift between what the user sees in Step 3 and what the local decision tracker can record for the selected coin.
4. The risk store still carries legacy geometry state for compatibility.
   - This is not breaking the visible Step 3 workflow, but it increases cognitive and maintenance load.

## Recommended next edits
- Rename Step 3 workflow semantics in `src/utils/workflowGuidance.ts` from `RISK CHECK` to `POSITION COMPOSITION`.
- Rework `trackAllDecisionSnapshots()` so tracker analytics use the actual automatic composition output instead of legacy `riskInputs`.
- Consider isolating legacy manual risk fields behind a compatibility boundary to reduce accidental reuse.

## Risk level
- Low for end-user trade workflow
- Medium for analytics/tracker truthfulness and future maintenance

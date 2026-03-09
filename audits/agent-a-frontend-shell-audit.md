# Agent A - Frontend Shell Audit

## Goal
Audit the shipped observatory shell, analytics page, candle report flow, responsive behavior, and accessibility of the current user-facing product.

## Files inspected
- `src/components/observatory/ObservatoryLayout.tsx`
- `src/components/observatory/IndicatorClusterLanes.tsx`
- `src/components/observatory/CandleReportPage.tsx`
- `src/components/observatory/AnalyticsPage.tsx`
- `src/hooks/useHashRouter.ts`
- `src/index.css`

## Findings
1. High - viewport-dependent heatmap density is computed from `window.innerWidth` during render and does not update on resize.
   - `IndicatorClusterLanes.tsx` derives `isNarrowViewport` directly from `window.innerWidth` with no resize subscription.
   - Impact: desktop-to-mobile and mobile-to-desktop resizes can leave the heatmap in the wrong density mode until some unrelated rerender happens.
   - Fix: track viewport width in component state and update it on `resize`.

2. Medium - several interactive controls are missing accessibility state or labels.
   - `ObservatoryLayout.tsx` has toggle-style controls for chart collapse, catalog expansion, runtime detail, and health detail without `aria-expanded` or `aria-pressed`.
   - `CandleReportPage.tsx` uses arrow-only prev/next buttons with no accessible label.
   - Impact: screen-reader and keyboard users do not get reliable control semantics.
   - Fix: add `aria-expanded`, `aria-controls`, and explicit `aria-label` where applicable.

3. Medium - route transitions between `Observatory` and `Analytics` do not preserve current coin or interval in the URL.
   - `useHashRouter.ts` navigates to bare `#/observatory` and `#/analytics`.
   - Impact: deep links do not reflect the current analysis context, and reload/share behavior is weaker than the live state suggests.
   - Fix: optionally extend route builders to carry coin/interval query state for non-report pages.

4. Low - the report chart drawer defaults closed, which keeps the page dense, but the state is not exposed semantically.
   - This is mainly an accessibility/polish issue once the toggle semantics are fixed.

## Recommended next edits
- Fix the heatmap resize behavior immediately.
- Add semantic toggle metadata to current shell controls.
- In a follow-up pass, decide whether non-report routes should preserve coin/interval in the hash.

## Review
- The resize bug is a real user-facing defect and safe to fix without changing product behavior.
- The accessibility fixes are low-risk and align with the current UI.
- URL-state preservation is useful, but it touches navigation behavior and should be treated as a follow-up rather than bundled into the first patch.

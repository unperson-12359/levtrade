# Agent C - API and Parity Audit

## Goal
Audit the active Vercel API surface for contract consistency, freshness semantics, and request validation.

## Files inspected
- `api/observatory-snapshot.ts`
- `api/server-setups.ts`
- `api/signal-accuracy.ts`
- `api/collector-heartbeat.ts`
- `api/upload-setups.ts`
- `api/events/stream.ts`
- `api/_contracts.ts`
- `api/_supabase.ts`

## Findings
1. High - `/api/server-setups` freshness metadata is derived from the filtered response set, not the canonical dataset.
   - Incremental `updatedSince` requests can return zero rows and still mark freshness as `delayed`.
   - Impact: browser health/freshness logic can degrade incorrectly.
   - Fix: query the latest canonical row separately and build freshness from that marker.

2. Medium - day-window query parsing is only capped on the high side.
   - `server-setups.ts` and `signal-accuracy.ts` use `Math.min(MAX_DAYS, parsedDays || DEFAULT_DAYS)` without a lower clamp.
   - Impact: `days=0` or negative values can produce nonsensical future `since` timestamps.
   - Fix: clamp to a minimum of `1`.

3. Medium - contract responses are slightly inconsistent across endpoints.
   - Example: `collector-heartbeat.ts` 405 path omits the contract metadata used elsewhere.
   - Impact: low direct user risk, but it weakens client expectations and parity discipline.
   - Fix: normalize 405/503/error response bodies across the active API surface.

4. Low - `/api/events/stream` is operationally closer to a status snapshot endpoint than a persistent event stream.
   - This is primarily a naming/documentation issue unless a true live stream is required.

## Recommended next edits
- Fix `server-setups` freshness semantics now.
- Clamp `days` query parsing in `server-setups` and `signal-accuracy`.
- Normalize minor response-shape inconsistencies in a follow-up pass.

## Review
- The freshness bug is the important one because it leaks directly into browser trust signals.
- Query clamping is a straightforward hardening improvement and safe to bundle with the freshness fix.

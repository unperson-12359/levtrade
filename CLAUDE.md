# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build              # Full pipeline: tsc -b && typecheck:api && vite build && build:signals
npm run dev                # Vite dev server (port 5173)
npm run test:logic         # Logic regression tests (builds signals bundle first)
npm run test:e2e           # Playwright E2E tests (full suite)
npm run test:e2e:critical  # Playwright E2E — @critical tag only
npm run lint               # ESLint
npm run gate:release       # Full release gate (build + tests + signoff check)
npm run smoke:release      # HTTP smoke tests against deployed endpoints
```

**Build has three type-check passes:**
1. `tsc -b` — main app (`tsconfig.app.json`, includes `.tsx`)
2. `tsc -p tsconfig.api.json` — API layer (`.ts` only, no JSX — don't import from `.tsx` files in anything under `src/` that's pure `.ts`)
3. `vite build` — production bundle
4. `build:signals` — esbuild bundles `src/signals/api-entry.ts` → `api/_signals.mjs` for serverless use

## Architecture

**Single-product app.** `App.tsx` mounts only `ObservatoryLayout`. Everything else is legacy/removed.

### Data flow

```
Hyperliquid REST/WS → DataManager → Zustand store → useIndicatorObservatory → ObservatoryLayout
                                                          ↑
                                              Server snapshot (api/observatory-snapshot.ts)
                                              merges with local live candles
```

- **DataManager** (`src/services/dataManager.ts`) — coordinates WebSocket mids subscription + candle polling with bounded recent-window refreshes after initial hydration.
- **useIndicatorObservatory** — browser model builder combining local candles + server snapshot into one `ObservatorySnapshot`.
- **useObservatoryState** (`src/hooks/useObservatoryState.ts`) — extracted state hook containing all view state, derived data, and navigation callbacks for the observatory.
- **Observatory engine** (`src/observatory/engine.ts`) — shared between browser and server. Computes 12 event-driven indicators across 5 categories (Trend, Momentum, Volatility, Volume, Structure), bar states, heatmap clusters, correlation edges, and health checks.

### Serverless API (`/api`)

Vercel functions. Four observatory endpoints:
- `observatory-snapshot.ts` — live hydration (30s timeout, 60s CDN cache)
- `observatory-analytics.ts` — reads from Supabase ledger (30s timeout, 5min cache)
- `persist-observatory-states.ts` — cron writer, runs daily 2:15 AM UTC (300s timeout, secret-gated)
- `backfill-observatory-states.ts` — manual backfill for one coin+interval (300s timeout, secret-gated)

The `api/_signals.mjs` bundle is generated — never edit it directly.

### State management

Zustand v5 with persist middleware → throttled localStorage. Store exposed at `window.__LEVTRADE_STORE__` for E2E.

### Routing

Hash-based via `useHashRouter`. Pages: observatory (default), analytics, methodology, candle report, heatmap.

### CSS

Tailwind v4 — no `tailwind.config.js`. Uses `@theme` block in `src/index.css` with CSS custom properties. Component styles use `obs-*` class namespace (editorial design system). Dark theme only.

## Key conventions

- **Tracked coins:** BTC, ETH, SOL, HYPE (defined in `src/types/market.ts` as `TRACKED_COINS`)
- **Allowed intervals:** `1d` only for the observatory
- **Hyperliquid API quirk:** candleSnapshot needs nested `req`: `{type:"candleSnapshot", req:{coin,interval,startTime}}`
- **Shared code:** `src/observatory/` modules are used by both browser and serverless functions. Changes here affect both runtimes.
- **Persistence:** `observatory_indicator_states` Supabase table. Each row tagged with `rule_version` from `src/observatory/version.ts`.
- **Format utilities:** All shared formatters live in `src/observatory/format.ts`. Don't duplicate formatting logic in components.

## Testing

- **Logic tests** (`tests/run-logic-tests.mjs`): Node.js `assert/strict` — source checks (verify specific strings exist in specific files) + computational checks (indicator engine, analytics builder). These are regression gates.
- **E2E tests** (`tests/e2e/critical-flows.spec.ts`): Playwright, Chrome only, single worker. Uses `VITE_E2E_MOCK=1` to mock HTTP.
- **Release gate** (`scripts/release-gate.mjs`): Runs build → test:logic → test:e2e:critical → checks signoff file exists.

When logic tests check for specific strings in source files (e.g. `assert.match(layoutSource, /somePattern/)`), update those assertions if you move code between files.

## Agent coordination

Before editing, check `COLLAB_LOG.md` for claimed areas. After editing, append an entry with date, agent, goal, files changed, and follow-up notes. See `AGENTS.md`.

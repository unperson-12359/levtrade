# Release Signoff

- Date: `2026-03-10`
- Candidate: `be35fba`
- Owner: `Codex`
- Status: `PASS`

## Automated Checks
- [x] Automated: `npm run build`
- [x] Automated: `npm run test:logic`
- [x] Automated: `npm run test:e2e:critical`
- [x] Automated: `npm run smoke:release -- --base-url https://levtrade.vercel.app --coin BTC --interval 4h --days 180`

## Manual Checks
- [x] Manual: Responsive matrix (`360`, `390`, `412`, `960`, `1280`)
- [x] Manual: Live shell continuity verification
- [x] Manual: Ledger freshness verification

## Notes
- Production deployment verified for candidate `be35fba`
- Production alias: `https://levtrade.vercel.app`
- Deployment URL: `https://levtrade-oqru0g12d-unperson12359s-projects.vercel.app`
- Responsive matrix spot-check passed on the production alias at `360`, `390`, `412`, `960`, and `1280`; the observatory shell, command bar, and price strip remained visible at each viewport.
- Production continuity spot-check passed: methodology, analytics, and observatory navigation all rendered on the live alias and returned to the heatmap shell without blanking the page.
- Production smoke passed against the alias with:
  - root `200`
  - `/api/observatory-snapshot?coin=BTC&interval=4h` returning `200`
  - `/api/observatory-analytics?coin=BTC&interval=4h&days=180` returning `ok: true`
- Production smoke was rechecked on `2026-03-10` against `https://levtrade.vercel.app` after the in-chart bubble overlay release.
- Ledger freshness verification passed from the live analytics route with:
  - `windowBars: 1078`
  - `lastPersistedBarTime: 2026-03-10T08:00:00.000Z`

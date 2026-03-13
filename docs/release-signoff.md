# Release Signoff

- Date: `2026-03-11`
- Candidate: `5ab291f`
- Owner: `Codex`
- Status: `PASS`

## Automated Checks
- [x] Automated: `npm run build`
- [x] Automated: `npm run test:logic`
- [x] Automated: `npm run test:e2e:critical`
- [x] Automated: `npm run smoke:release -- --base-url https://levtrade.vercel.app --coin BTC --interval 1d --days 180`

## Manual Checks
- [x] Manual: Responsive matrix (`360`, `390`, `412`, `960`, `1280`)
- [x] Manual: Live shell continuity verification
- [x] Manual: Ledger freshness verification

## Notes
- Production deployment verified for candidate `5ab291f`
- Production alias: `https://levtrade.vercel.app`
- Deployment URL: `https://levtrade-ogwn9o6ng-unperson12359s-projects.vercel.app`
- Responsive matrix spot-check passed on the production alias at `360`, `390`, `412`, `960`, and `1280`; the observatory shell, command bar, and price strip remained visible at each viewport.
- Production continuity spot-check passed: methodology, analytics, and observatory navigation all rendered on the live alias and returned to the heatmap shell without blanking the page.
- Production smoke passed against the alias with:
  - root `200`
  - `/api/observatory-snapshot?coin=BTC&interval=1d` returning `200`
  - `/api/observatory-analytics?coin=BTC&interval=1d&days=180` returning `ok: true`
- Production smoke was rechecked on `2026-03-11` against `https://levtrade.vercel.app` after the chart heat-circle marker release.
- Ledger freshness verification passed from the live analytics route with:
  - `windowBars: 1078`
  - `lastPersistedBarTime: 2026-03-10T08:00:00.000Z`

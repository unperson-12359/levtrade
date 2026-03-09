# Release Signoff

- Date: `2026-03-08`
- Candidate: `d9e84ed`
- Owner: `Codex`
- Status: `PASS`

## Automated Checks
- [x] Automated: `npm run build`
- [x] Automated: `npm run test:logic`
- [x] Automated: `npm run test:e2e:critical`

## Manual Checks
- [x] Manual: Responsive matrix (`360`, `390`, `412`, `960`, `1280`)
- [x] Manual: 10+ minute production soak with intermittent network instability
- [x] Manual: Trust source verification (canonical server vs fallback copy)

## Notes
- Production deployment: `https://levtrade-9htsh43e4-unperson12359s-projects.vercel.app`
- Production alias: `https://levtrade.vercel.app`
- Responsive matrix on the production alias showed the observatory shell, price chart, and indicator heatmap visible at `360`, `390`, `412`, `960`, and `1280`.
- Trust source verification passed after the bundling repair: the production observatory freshness chip showed `fresh`, and `/api/observatory-snapshot?coin=BTC&interval=4h` returned HTTP `200` with `ok: true`, `meta.freshness: fresh`, and `meta.source: derived`.
- Production soak duration: `669s` (11 minutes 9 seconds), with alternating offline/online cycles every minute; the shell stayed visible throughout and runtime remained `OK`.
- Post-deploy API checks: `/api/observatory-snapshot?coin=BTC&interval=4h`, `/api/server-setups`, `/api/signal-accuracy`, and `/api/collector-heartbeat` returned HTTP `200`.

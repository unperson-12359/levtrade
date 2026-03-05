# Release Signoff

- Date: `YYYY-MM-DD`
- Candidate: `commit-sha`
- Owner: `name`
- Status: `PENDING` (`PASS` only when all checks below are complete)

## Automated Checks
- [ ] Automated: `npm run build`
- [ ] Automated: `npm run test:logic`
- [ ] Automated: `npm run test:e2e:critical`

## Manual Checks
- [ ] Manual: Responsive matrix (`360`, `390`, `412`, `960`, `1280`)
- [ ] Manual: 10+ minute production soak with intermittent network instability
- [ ] Manual: Trust source verification (canonical server vs fallback copy)

## Notes
- Record any accepted risk waivers with owner + target fix date.

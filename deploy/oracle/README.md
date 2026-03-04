# Oracle VM collector deployment

This deployment model runs the LevTrade collector on an always-on Oracle VM and keeps the frontend as a viewer.

## 1. Prepare the VM

Use a fresh deploy directory:

```bash
sudo mkdir -p /srv/levtrade/collector
sudo chown -R "$USER":"$USER" /srv/levtrade/collector
cd /srv/levtrade/collector
git clone <your-repo-url> app
cd app
npm ci
npm run build:collector
```

## 2. Create the env file

Create `/srv/levtrade/collector/.env.collector`:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
COINALYZE_API_KEY=...
```

`COINALYZE_API_KEY` is optional. If omitted, the collector falls back to Supabase-backed OI history.

## 3. Build and verify locally before restart

From the repo root:

```bash
npm run test:logic
npm run build
npm run build:collector
```

The Vercel fallback path depends on the bundled API artifacts:
- `api/_signals.mjs`
- `api/_collector.mjs`

## 4. Install the service

Copy and adjust the template if your deploy user/path differ:

```bash
sudo cp deploy/oracle/levtrade-collector.service /etc/systemd/system/levtrade-collector.service
sudo systemctl daemon-reload
sudo systemctl enable --now levtrade-collector
```

## 5. Verify it is running

```bash
sudo systemctl status levtrade-collector
journalctl -u levtrade-collector -f
```

Expected healthy behavior:
- the collector service stays active
- new heartbeat rows appear in `collector_heartbeat`
- new setups and resolved outcomes continue to update in Supabase

## 6. Updating after new deploys

```bash
cd /srv/levtrade/collector/app
git pull
npm ci
npm run build:collector
sudo systemctl restart levtrade-collector
```

## 7. Post-restart checks

After restart, verify:
- `collector_heartbeat` shows a recent `last_run_at`
- Setup History in the frontend picks up canonical settlement updates without a full reload
- `/api/collector-heartbeat` reports `live` when the collector is healthy
- `/api/signal-accuracy` continues to return canonical data

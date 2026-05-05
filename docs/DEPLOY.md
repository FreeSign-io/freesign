# FreeSign deployment

## One-time server setup

1. Provision a Linux server (Ubuntu 24.04 LTS, 4 GB RAM minimum recommended).
2. Point your domain's A record (`freesign.io`, `www.freesign.io`) at the server IP.
3. Install dependencies:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
   sudo apt-get install -y nodejs git caddy ufw
   curl -fsSL https://get.docker.com | sh
   ```
4. Clone the fork:
   ```bash
   sudo mkdir -p /opt/freesign && sudo chown $USER:$USER /opt/freesign
   git clone https://github.com/FreeSign-io/freesign.git /opt/freesign/app
   ```
5. Create `/opt/freesign/app/.env` (see `apps/remix/.env.example`; secrets must be 32+ chars).
6. Start Postgres in Docker:
   ```bash
   cd /opt/freesign/app/docker/production
   sudo docker compose up -d database
   ```
7. Generate a self-signed signing cert per `apps/remix/SIGNING.md`.
8. Install the systemd unit at `/etc/systemd/system/freesign.service` and reload:
   ```bash
   sudo systemctl daemon-reload && sudo systemctl enable freesign
   ```
9. Configure Caddy (`/etc/caddy/Caddyfile`) for `freesign.io` reverse-proxying
   `localhost:3000`, with the marketing landing served at exactly `/` for
   anonymous visitors. See `landing/index.html`.
10. First deploy:
    ```bash
    sudo /opt/freesign/app/deploy.sh
    ```

## Subsequent deploys

```bash
sudo /opt/freesign/app/deploy.sh           # latest origin/main
sudo /opt/freesign/app/deploy.sh <sha>     # specific commit/tag
```

## Continuous deployment via GitHub Actions

Pushing to `main` triggers `.github/workflows/deploy.yml`, which SSH's into
the production server and runs `deploy.sh`. Required GitHub repository
secrets (recommended: scope under a `production` Environment so you can
add reviewers / branch protection):

| Secret              | Value                                                  |
|---------------------|--------------------------------------------------------|
| `DEPLOY_SSH_HOST`   | Server hostname or IP (e.g. `freesign.io`)             |
| `DEPLOY_SSH_USER`   | User with passwordless `sudo` for `deploy.sh`          |
| `DEPLOY_SSH_KEY`    | Private SSH key (full PEM) authorized on the server    |
| `DEPLOY_SSH_PORT`   | SSH port (usually `22`)                                |

### Generate a deploy keypair

On the server:

```bash
sudo ssh-keygen -t ed25519 -f /root/.ssh/freesign_deploy -N ""
sudo cat /root/.ssh/freesign_deploy.pub | sudo tee -a /root/.ssh/authorized_keys
sudo chmod 600 /root/.ssh/authorized_keys
sudo cat /root/.ssh/freesign_deploy        # paste the entire output as DEPLOY_SSH_KEY
```

Optional security hardening: bind the deploy key to only the deploy
command via `command="sudo /opt/freesign/app/deploy.sh"` in
`authorized_keys`, and disable interactive shells for the deploy key.

## Resource requirements

- Minimum: **2 GB RAM + 4 GB swap** (esbuild's server bundle is much
  lighter than the previous rollup pass, but `react-router build` and
  `npm install` can still spike on small VPS hosts)
- Recommended: **4 GB RAM** (no swap pressure)
- Disk: ~20 GB (node_modules + DB volume + Docker images)

## Troubleshooting

- `sudo systemctl status freesign` — service state
- `sudo journalctl -fu freesign` — live app logs
- `sudo docker compose -f /opt/freesign/freesign/docker/production/compose.yml ps` — Postgres state
- `sudo systemctl reload caddy` — apply Caddy changes after editing `/etc/caddy/Caddyfile`

If deploy.sh fails with `JavaScript heap out of memory`, raise `NODE_HEAP_MB`
in the script (default 3072) or increase the server's RAM/swap.

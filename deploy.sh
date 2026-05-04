#!/usr/bin/env bash
# FreeSign deploy script.
# Run on the freesign server (Ubuntu, Node 22, Caddy, postgres in docker).
# Pulls latest source, builds the Remix app + Rollup server bundle, restarts
# the freesign systemd service.
#
# Idempotent: re-runs cheaply when there are no source changes (npm ci is the
# slow path; build is always run).
#
# Usage:
#   sudo /opt/freesign/app/deploy.sh           # latest from origin/main
#   sudo /opt/freesign/app/deploy.sh <ref>     # specific tag/branch/sha

set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/freesign/app}"
ENV_FILE="${ENV_FILE:-$REPO_DIR/.env}"
BRANCH="${1:-origin/main}"
SERVICE="${SERVICE:-freesign}"
NODE_HEAP_MB="${NODE_HEAP_MB:-3072}"

log() { printf '\n\033[1;32m[deploy]\033[0m %s\n' "$*"; }
warn() { printf '\n\033[1;33m[deploy:warn]\033[0m %s\n' "$*" >&2; }
die() { printf '\n\033[1;31m[deploy:fatal]\033[0m %s\n' "$*" >&2; exit 1; }

[[ -d "$REPO_DIR" ]] || die "REPO_DIR=$REPO_DIR not found. Clone the fork there first."
[[ -f "$ENV_FILE" ]] || die "ENV_FILE=$ENV_FILE not found. Production env required."

cd "$REPO_DIR"

log "Pulling $BRANCH"
git fetch origin --quiet
git reset --hard "$BRANCH"
git log -1 --oneline

# Decide whether npm ci is needed: only if lockfile or top-level package.json changed
NEED_INSTALL=0
if [[ ! -d node_modules ]]; then
  NEED_INSTALL=1
elif ! git diff --quiet HEAD@{1} HEAD -- package-lock.json package.json 2>/dev/null; then
  NEED_INSTALL=1
fi

if [[ $NEED_INSTALL -eq 1 ]]; then
  log "Running npm install (lockfile changed or fresh tree)"
  # Stop the running service to free RAM during install on small VPS
  systemctl stop "$SERVICE" || true
  NODE_OPTIONS="--max-old-space-size=$NODE_HEAP_MB" npm install --prefer-offline
else
  log "Lockfile unchanged - skipping npm install"
fi

# Build pipeline. We avoid `npm run build` (turbo) because it also builds
# apps/docs which we don't host, and turbo's typecheck step OOMs on a 2 GB VPS.
# Instead, run only the steps we need for the Remix server.
log "Translate (lingui extract + compile)"
NODE_OPTIONS="--max-old-space-size=$NODE_HEAP_MB" npm run translate

cd "$REPO_DIR/apps/remix"

log "Build app (react-router)"
NODE_OPTIONS="--max-old-space-size=$NODE_HEAP_MB" \
  npx cross-env NODE_ENV=production react-router build

log "Build server (rollup)"
NODE_OPTIONS="--max-old-space-size=$NODE_HEAP_MB" \
  npx cross-env NODE_ENV=production rollup -c rollup.config.mjs

# Copy entrypoint into build dir (matches what the official build.sh does).
cp -f server/main.js build/server/main.js

# Rollup's TS plugin compiles imports but doesn't copy already-compiled .mjs
# Lingui catalogs into the bundle. The Hono runtime imports them via dynamic
# `import('packages/lib/translations/<locale>/web.mjs')`, so we mirror them
# into the rolled-up output directory.
mkdir -p build/server/hono/packages/lib/translations
cp -r "$REPO_DIR"/packages/lib/translations/* build/server/hono/packages/lib/translations/

[[ -f build/server/main.js ]] || die "build/server/main.js missing after build"
[[ -f build/server/index.js ]] || die "build/server/index.js missing after build"
[[ -f build/server/hono/packages/lib/translations/en/web.mjs ]] \
  || die "translations not copied into build/server/hono/"

cd "$REPO_DIR"

log "Reloading systemd unit + restarting $SERVICE"
systemctl daemon-reload
systemctl restart "$SERVICE"

# Wait briefly and confirm health
sleep 6
if systemctl is-active --quiet "$SERVICE"; then
  log "$SERVICE is active"
else
  systemctl status "$SERVICE" --no-pager | tail -20
  die "$SERVICE failed to start - check 'journalctl -u $SERVICE'"
fi

# Smoke test the local proxy target
if curl -sI -m 5 http://localhost:3000/ | head -1 | grep -qE '^HTTP/[12](\.[01])? (200|302)'; then
  log "localhost:3000 responding"
else
  warn "localhost:3000 not yet responding - app may still be warming up"
fi

log "Deploy complete. journalctl -fu $SERVICE for logs."

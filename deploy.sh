#!/usr/bin/env bash
# FreeSign deploy script.
# Run on the freesign server (Ubuntu, Node 22, Caddy, postgres in docker).
# Pulls latest source, builds the Remix app + esbuild server bundle, restarts
# the freesign systemd service.
#
# Idempotent: re-runs cheaply when there are no source changes (npm ci is the
# slow path; build is always run).
#
# Two deploy modes:
#   1. In-place build (default): runs translate:compile + react-router build +
#      esbuild on the VPS. Slow on a 2 GB box (~2-4 min) but self-contained.
#   2. Artifact mode: when DEPLOY_ARTIFACT_PATH or --from-artifact is set, the
#      script extracts a prebuilt apps/remix/build/ tarball produced by CI and
#      skips the build steps entirely. Sub-1-minute deploy on the VPS.
#
# Usage:
#   sudo /opt/freesign/app/deploy.sh                          # build on VPS (fallback)
#   sudo /opt/freesign/app/deploy.sh <ref>                    # specific tag/branch/sha
#   sudo DEPLOY_ARTIFACT_PATH=/path/to/bundle.tar.gz \
#        /opt/freesign/app/deploy.sh                          # use prebuilt bundle
#   sudo /opt/freesign/app/deploy.sh --from-artifact <path>   # same, via arg

set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/freesign/app}"
ENV_FILE="${ENV_FILE:-$REPO_DIR/.env}"
SERVICE="${SERVICE:-freesign}"
NODE_HEAP_MB="${NODE_HEAP_MB:-3072}"

# --- Argument parsing ------------------------------------------------------
# Backward compatible: a positional arg that is NOT a flag is still the git
# ref to deploy (origin/main, a tag, a sha). `--from-artifact <path>` is the
# new flag; alternately set DEPLOY_ARTIFACT_PATH in the environment.
ARTIFACT_PATH="${DEPLOY_ARTIFACT_PATH:-}"
BRANCH=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --from-artifact)
      ARTIFACT_PATH="${2:-}"
      shift 2
      ;;
    --from-artifact=*)
      ARTIFACT_PATH="${1#--from-artifact=}"
      shift
      ;;
    *)
      if [[ -z "$BRANCH" ]]; then
        BRANCH="$1"
      fi
      shift
      ;;
  esac
done
BRANCH="${BRANCH:-origin/main}"

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

# Self-update guard: if deploy.sh on disk no longer matches what's in
# memory, re-exec the new script. Otherwise we'd run a hybrid of the
# old script (already loaded) against the new filesystem layout, which
# is how prod went down on 2026-05-05.
SCRIPT_PATH="$(readlink -f "$0")"
DISK_SHA=$(sha256sum "$SCRIPT_PATH" | awk '{print $1}')
MEM_SHA="${DEPLOY_SCRIPT_SHA:-unset}"
if [[ "$MEM_SHA" == "unset" ]]; then
  # First run: re-exec with the SHA env var so the next invocation can
  # detect a script swap. Pass through the resolved BRANCH and ARTIFACT_PATH
  # explicitly: we already consumed flags above, so $@ is no longer the
  # original arg list.
  export DEPLOY_SCRIPT_SHA="$DISK_SHA"
  export DEPLOY_ARTIFACT_PATH="$ARTIFACT_PATH"
  exec "$SCRIPT_PATH" "$BRANCH"
elif [[ "$MEM_SHA" != "$DISK_SHA" ]]; then
  # On-disk script changed since this process started. Re-exec.
  log "deploy.sh changed on disk after fetch - re-executing new script"
  export DEPLOY_SCRIPT_SHA="$DISK_SHA"
  export DEPLOY_ARTIFACT_PATH="$ARTIFACT_PATH"
  exec "$SCRIPT_PATH" "$BRANCH"
fi

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

# Apply Prisma migrations + regenerate the client every deploy. Both are
# idempotent: `migrate deploy` is a no-op when the DB is already at head,
# and `generate` is a few-second client codegen. Folding them in here means
# schema changes (e.g. PR #4's normalizationStatus column) ship with the
# deploy instead of needing a manual `npx prisma migrate deploy` after.
log "Applying Prisma migrations + regenerating client"
NODE_OPTIONS="--max-old-space-size=$NODE_HEAP_MB" \
  npx prisma migrate deploy --schema packages/prisma/schema.prisma
NODE_OPTIONS="--max-old-space-size=$NODE_HEAP_MB" \
  npx prisma generate --schema packages/prisma/schema.prisma

# Build pipeline. Two paths:
#   1. Artifact mode (DEPLOY_ARTIFACT_PATH set): extract a prebuilt
#      apps/remix/build/ tarball produced by CI. Skips translate:compile,
#      react-router build, and esbuild entirely - those already ran on the
#      runner. ~2-4 min saved on a 2 GB VPS.
#   2. In-place build (fallback): runs the same steps the old script did.
#
# We avoid `npm run build` (turbo) because it also builds apps/docs which we
# don't host, and turbo's typecheck step OOMs on a 2 GB VPS. The in-place
# branch keeps the surgical step list:
#   - Run `translate:compile` only (skip `translate:extract` - that's a
#     developer step; on prod the source is already in sync with the
#     committed .po files).
#   - Invoke the `react-router` binary directly (NOT `npm run build:app`),
#     which skips the `npm run typecheck` (`react-router typegen && tsc`)
#     step. CI already typechecks the same SHA before this script runs, so
#     re-running tsc here just burns ~78s on a 2 GB VPS.
#   - Run translate:compile and the react-router build in parallel - they're
#     independent.

if [[ -n "$ARTIFACT_PATH" ]]; then
  [[ -f "$ARTIFACT_PATH" ]] \
    || die "DEPLOY_ARTIFACT_PATH=$ARTIFACT_PATH not found on disk"

  log "Artifact mode: extracting $ARTIFACT_PATH into apps/remix/build/"

  # Stop the service before swapping files so we don't run a half-extracted
  # bundle. The post-build restart further down brings it back up.
  systemctl stop "$SERVICE" || true

  # Wipe the previous build tree to avoid stale files lingering when the new
  # bundle has a different layout. The tarball is rooted at apps/remix/build,
  # so we extract straight into that directory.
  rm -rf "$REPO_DIR/apps/remix/build"
  mkdir -p "$REPO_DIR/apps/remix/build"
  tar -xzf "$ARTIFACT_PATH" -C "$REPO_DIR/apps/remix/build"

  cd "$REPO_DIR/apps/remix"
else
  log "Translate (compile) + build app (parallel)"

  # Background: lingui compile (writes .mjs catalogs from .po files)
  ( cd "$REPO_DIR" \
    && NODE_OPTIONS="--max-old-space-size=$NODE_HEAP_MB" npm run translate:compile ) &
  TRANSLATE_PID=$!

  # Background: react-router build (Remix client + server bundle).
  # Call the hoisted binary directly to avoid `npm run build:app`, which
  # prepends a typecheck step. The binary is at the workspace root via npm
  # hoisting.
  ( cd "$REPO_DIR/apps/remix" \
    && NODE_OPTIONS="--max-old-space-size=$NODE_HEAP_MB" NODE_ENV=production \
       "$REPO_DIR/node_modules/.bin/react-router" build ) &
  BUILD_PID=$!

  wait $TRANSLATE_PID || die "translate:compile failed"
  wait $BUILD_PID    || die "react-router build failed"

  cd "$REPO_DIR/apps/remix"

  log "Build server (esbuild)"
  NODE_OPTIONS="--max-old-space-size=$NODE_HEAP_MB" \
    npx cross-env NODE_ENV=production node esbuild.config.mjs

  # Copy entrypoint into build dir (matches what the official build.sh does).
  cp -f server/main.js build/server/main.js

  # esbuild bundles the TS source into a single file at
  # build/server/hono/server/router.js. The Hono runtime imports compiled
  # Lingui catalogs via `import(new URL('../packages/lib/translations/...',
  # import.meta.url))`, which resolves relative to the bundle. Mirror the
  # .mjs catalogs into that location.
  mkdir -p build/server/hono/packages/lib/translations
  cp -r "$REPO_DIR"/packages/lib/translations/* build/server/hono/packages/lib/translations/
fi

[[ -f build/server/main.js ]] || die "build/server/main.js missing after build"
[[ -f build/server/index.js ]] || die "build/server/index.js missing after build"
[[ -f build/server/hono/packages/lib/translations/en/web.mjs ]] \
  || die "translations not copied into build/server/hono/"

cd "$REPO_DIR"

log "Reloading systemd unit + restarting $SERVICE"
# Re-sync translations one more time as a belt-and-braces guard. If a previous
# deploy was interrupted between the rollup output and the cp above, the
# translations dir would be missing and the service would crash-loop.
mkdir -p "$REPO_DIR/apps/remix/build/server/hono/packages/lib/translations"
cp -rf "$REPO_DIR"/packages/lib/translations/* \
  "$REPO_DIR/apps/remix/build/server/hono/packages/lib/translations/"

systemctl daemon-reload
systemctl restart "$SERVICE"

# Poll for service health: exit as soon as the service is active AND the local
# port responds, with a 30s overall budget. Replaces the old flat 6s sleep,
# which was either too long (cold boot < 6s) or too short (occasional warm-up
# > 6s causing a noisy warning).
log "Waiting for $SERVICE to become healthy"
SECONDS=0
HEALTHY=0
while (( SECONDS < 30 )); do
  if systemctl is-active --quiet "$SERVICE" \
     && curl -sI -m 2 http://localhost:3000/ 2>/dev/null \
        | head -1 | grep -qE '^HTTP/[12](\.[01])? (200|302)'; then
    log "localhost:3000 responding (took ${SECONDS}s)"
    HEALTHY=1
    break
  fi
  sleep 1
done
if (( HEALTHY == 0 )); then
  systemctl status "$SERVICE" --no-pager | tail -20
  die "$SERVICE did not become healthy within 30s - check 'journalctl -u $SERVICE'"
fi

log "Deploy complete. journalctl -fu $SERVICE for logs."

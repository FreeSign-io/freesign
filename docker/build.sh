#!/usr/bin/env bash

command -v docker >/dev/null 2>&1 || {
    echo "Docker is not running. Please start Docker and try again."
    exit 1
}

SCRIPT_DIR="$(readlink -f "$(dirname "$0")")"
MONOREPO_ROOT="$(readlink -f "$SCRIPT_DIR/../")"

APP_VERSION="$(git name-rev --tags --name-only $(git rev-parse HEAD) | head -n 1 | sed 's/\^0//')"
GIT_SHA="$(git rev-parse HEAD)"

echo "Building docker image for monorepo at $MONOREPO_ROOT"
echo "App version: $APP_VERSION"
echo "Git SHA: $GIT_SHA"

docker build -f "$SCRIPT_DIR/Dockerfile" \
    --progress=plain \
    --build-arg NEXT_PRIVATE_TELEMETRY_KEY="${NEXT_PRIVATE_TELEMETRY_KEY:-}" \
    --build-arg NEXT_PRIVATE_TELEMETRY_HOST="${NEXT_PRIVATE_TELEMETRY_HOST:-}" \
    -t "freesign-base" \
    "$MONOREPO_ROOT"

if [ ! -z "$DOCKER_REPOSITORY" ]; then
    echo "Using custom repository: $DOCKER_REPOSITORY"

    docker tag "freesign-base" "$DOCKER_REPOSITORY:latest"
    docker tag "freesign-base" "$DOCKER_REPOSITORY:$GIT_SHA"

    if [ ! -z "$APP_VERSION" ] && [ "$APP_VERSION" != "undefined" ]; then
        docker tag "freesign-base" "$DOCKER_REPOSITORY:$APP_VERSION"
    fi
else
    echo "Using default repository: ghcr.io/freesign-io/freesign"

    docker tag "freesign-base" "ghcr.io/freesign-io/freesign:latest"
    docker tag "freesign-base" "ghcr.io/freesign-io/freesign:$GIT_SHA"

    if [ ! -z "$APP_VERSION" ] && [ "$APP_VERSION" != "undefined" ]; then
        docker tag "freesign-base" "ghcr.io/freesign-io/freesign:$APP_VERSION"
    fi
fi

docker rmi "freesign-base"

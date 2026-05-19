#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="claude-sandbox"

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "Building $IMAGE..."
  docker build -t "$IMAGE" "$PROJECT_ROOT/.claude-sandbox"
fi

docker run -it --rm \
  --name claude-sandbox \
  -v "$PROJECT_ROOT:/workspace" \
  -v "$HOME/.claude:/home/claude/.claude" \
  -v "$HOME/.gitconfig:/home/claude/.gitconfig:ro" \
  -p 3000:3000 \
  "$IMAGE" "$@"

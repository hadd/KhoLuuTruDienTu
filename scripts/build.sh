#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_BASE="registry.gitlab.com/vaisawesome/outsource/llm-system/lms-admin-v2"
COMMIT_ID="${COMMIT_ID:-$(git -C "$ROOT_DIR" rev-parse --short HEAD)}"
IMAGE_TAG="${IMAGE_BASE}:${COMMIT_ID}"
DOCKERFILE_PATH="${ROOT_DIR}/Dockerfile"

echo "Building image ${IMAGE_TAG} from ${DOCKERFILE_PATH}"
echo "Note: Environment variables will be injected at runtime via docker-compose"

docker build \
  --file "${DOCKERFILE_PATH}" \
  --tag "${IMAGE_TAG}" \
  "${ROOT_DIR}"

echo "Pushing ${IMAGE_TAG}"
docker push "${IMAGE_TAG}"

echo "Done. Image pushed as ${IMAGE_TAG}"


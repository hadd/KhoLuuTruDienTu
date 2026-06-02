#!/usr/bin/env bash
set -euo pipefail

# Configure MinIO bucket notifications to call sohoa-backend when OCR metadata is written.
#
# Required environment variables:
#   MC_ALIAS          MinIO client alias (default: myminio)
#   MINIO_BUCKET      Target bucket (default: data-lake)
#   WEBHOOK_ENDPOINT  Backend webhook URL
#   MINIO_WEBHOOK_SECRET  Bearer token shared with backend MINIO_WEBHOOK_SECRET
#
# Example:
#   export MC_ALIAS=myminio
#   export MINIO_BUCKET=data-lake
#   export WEBHOOK_ENDPOINT=http://10.10.6.134:8000/api/v1/internal/minio-webhook
#   export MINIO_WEBHOOK_SECRET=your-secret
#   ./scripts/setup-minio-webhook.sh

MC_ALIAS="${MC_ALIAS:-myminio}"
MINIO_BUCKET="${MINIO_BUCKET:-data-lake}"
WEBHOOK_ENDPOINT="${WEBHOOK_ENDPOINT:-http://10.10.6.134:8000/api/v1/internal/minio-webhook}"
MINIO_WEBHOOK_SECRET="${MINIO_WEBHOOK_SECRET:-}"

if [[ -z "${MINIO_WEBHOOK_SECRET}" ]]; then
  echo "MINIO_WEBHOOK_SECRET is required" >&2
  exit 1
fi

echo "Configuring MinIO webhook target PRIMARY -> ${WEBHOOK_ENDPOINT}"
mc admin config set "${MC_ALIAS}" notify_webhook:PRIMARY \
  endpoint="${WEBHOOK_ENDPOINT}" \
  auth_token="${MINIO_WEBHOOK_SECRET}" \
  queue_limit="10000"

echo "Restarting MinIO to apply notification config..."
mc admin service restart "${MC_ALIAS}"

echo "Registering bucket event: put on processed/*.json"
mc event rm "${MC_ALIAS}/${MINIO_BUCKET}" --force || true
mc event add "${MC_ALIAS}/${MINIO_BUCKET}" \
  arn:minio:sqs::PRIMARY:webhook \
  --event put \
  --prefix processed/ \
  --suffix .json

echo "Current bucket events:"
mc event list "${MC_ALIAS}/${MINIO_BUCKET}"

echo "Done. Upload a test file to verify:"
echo "  mc cp sample.json ${MC_ALIAS}/${MINIO_BUCKET}/processed/test/sample.json"

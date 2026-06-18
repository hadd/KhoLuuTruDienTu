#!/bin/sh
set -e

SOCKET_VIA_PROXY="${VITE_SOCKET_VIA_PROXY:-false}"
SOCKET_PROXY_TARGET="${VITE_SOCKET_PROXY_TARGET:-${VITE_API_URL}}"

# Generate runtime config from environment variables
cat > /usr/share/nginx/html/env-config.js <<EOF
window.__ENV__ = {
  VITE_API_URL: "${VITE_API_URL}",
  VITE_SOCKET_URL: "${VITE_SOCKET_URL:-${VITE_API_URL}}",
  VITE_SOCKET_VIA_PROXY: "${SOCKET_VIA_PROXY}",
  VITE_POSTHOG_KEY: "${VITE_POSTHOG_KEY}",
  VITE_POSTHOG_HOST: "${VITE_POSTHOG_HOST}",
  VITE_DATA_UPLOAD_EXPIRY_SECONDS_PER_FILE: "${VITE_DATA_UPLOAD_EXPIRY_SECONDS_PER_FILE:-15}",
  VITE_DATA_UPLOAD_MAX_FILE_SIZE_MB: "${VITE_DATA_UPLOAD_MAX_FILE_SIZE_MB:-10}",
  VITE_PDF_MASK_TYPE: "${VITE_PDF_MASK_TYPE:-gaussian}",
  VITE_PDF_MASK_GAUSSIAN_BLUR_PX: "${VITE_PDF_MASK_GAUSSIAN_BLUR_PX:-18}",
  VITE_PDF_MASK_MOSAIC_BLOCK_SIZE: "${VITE_PDF_MASK_MOSAIC_BLOCK_SIZE:-14}",
};
EOF

if [ "$SOCKET_VIA_PROXY" = "true" ] && [ -n "$SOCKET_PROXY_TARGET" ]; then
  cat > /etc/nginx/socket-proxy-location.inc <<EOF
location /socket.io/ {
  proxy_pass ${SOCKET_PROXY_TARGET}/socket.io/;
  proxy_http_version 1.1;
  proxy_set_header Upgrade \$http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host \$host;
  proxy_set_header X-Real-IP \$remote_addr;
  proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto \$scheme;
  proxy_read_timeout 86400;
}
EOF
else
  cat > /etc/nginx/socket-proxy-location.inc <<EOF
# Socket proxy disabled.
EOF
fi

echo "Runtime configuration generated:"
cat /usr/share/nginx/html/env-config.js

# Execute the main command (nginx)
exec "$@"

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
};
EOF

if [ "$SOCKET_VIA_PROXY" = "true" ] && [ -n "$SOCKET_PROXY_TARGET" ]; then
  cat > /etc/nginx/conf.d/socket-proxy.conf <<EOF
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
  rm -f /etc/nginx/conf.d/socket-proxy.conf
fi

echo "Runtime configuration generated:"
cat /usr/share/nginx/html/env-config.js

# Execute the main command (nginx)
exec "$@"

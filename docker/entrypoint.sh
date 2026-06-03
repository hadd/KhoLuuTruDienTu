#!/bin/sh
set -e

# Generate runtime config from environment variables
cat > /usr/share/nginx/html/env-config.js <<EOF
window.__ENV__ = {
  VITE_API_URL: "${VITE_API_URL}",
  VITE_POSTHOG_KEY: "${VITE_POSTHOG_KEY}",
  VITE_POSTHOG_HOST: "${VITE_POSTHOG_HOST}",
  VITE_DATA_UPLOAD_EXPIRY_SECONDS_PER_FILE: "${VITE_DATA_UPLOAD_EXPIRY_SECONDS_PER_FILE:-15}",
};
EOF

echo "Runtime configuration generated:"
cat /usr/share/nginx/html/env-config.js

# Execute the main command (nginx)
exec "$@"

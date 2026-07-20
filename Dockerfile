ARG NODE_VERSION=20-alpine

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:${NODE_VERSION} AS build
WORKDIR /app
# Build without environment variables - they will be injected at runtime
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM nginx:1.27.3-alpine AS runner
# Copy nginx config
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
# Copy entrypoint script for runtime environment injection
#COPY docker/entrypoint.sh /entrypoint.sh
# RUN chmod +x /entrypoint.sh
COPY docker/entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh
# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  #CMD wget -qO- http://localhost/ || exit 1
  CMD wget -qO- http://127.0.0.1/ || exit 1
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
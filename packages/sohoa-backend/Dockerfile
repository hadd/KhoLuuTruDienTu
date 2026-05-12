# Use the official Deno image
FROM denoland/deno:2.5.4

# Set working directory
WORKDIR /app

# Stage 1: Cache dependencies
# Copy only configuration files first for better caching
COPY deno.jsonc ./
COPY deno.lock ./
RUN deno install

# Copy shared libraries (needed for dependency resolution)
COPY shared/ ./shared/

# Copy only the main entry point and deno.jsonc for dependency caching
COPY src/main.ts ./src/
COPY src/deno.jsonc ./src/

# Cache dependencies (this layer will be cached unless deno.jsonc or main.ts changes)

# Stage 2: Copy source code
# Copy the rest of the backend source code
COPY src/ ./src/

# Set working directory to backend
WORKDIR /app/src


EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

RUN deno cache main.ts

# Default command
CMD ["deno", "run", "--allow-all", "src/main.ts"]

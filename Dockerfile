FROM oven/bun:1.2.16-alpine AS base

# Install system dependencies including ffmpeg
RUN apk add --no-cache ffmpeg && rm -rf /var/cache/apk/*

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the Next.js application
# Environment variables used during build time
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_SHARP=1

RUN bun run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV SQLITE_DB_PATH=/app/data/veo-meta.sqlite

# Create a non-root user for running the application
# Use args to allow flexible UID/GID assignment
ARG UID=1001
ARG GID=1001

# Create group and user with specified UID/GID
RUN addgroup -g $GID -S veogroup && \
    adduser -u $UID -S veouser -G veogroup

# Copy application code, dependencies and build artifacts
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/bun.lockb ./bun.lockb
COPY --from=deps /app/node_modules ./node_modules

# Create directories and set proper ownership
RUN mkdir -p /app/credentials /app/data /app/public/videos /app/public/thumbnails && \
    chown -R veouser:veogroup /app

# Switch to non-root user
USER veouser:veogroup

EXPOSE 3000

ENV PORT=3000

# The start script from package.json will be used: "next start -H 0.0.0.0 -p 3000"
CMD ["bun", "run", "start"]

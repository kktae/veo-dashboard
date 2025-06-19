FROM oven/bun:1.2.16-alpine AS base

# Install system dependencies including ffmpeg and video processing tools
RUN apk add --no-cache \
    ffmpeg \
    # ffmpeg-dev \
    # imagemagick \
    # imagemagick-dev \
    # python3 \
    # python3-dev \
    # make \
    # g++ \
    # pkgconfig \
    # cairo-dev \
    # pango-dev \
    # jpeg-dev \
    # giflib-dev \
    # librsvg-dev \
    # pixman-dev \
    && rm -rf /var/cache/apk/*

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json bun.lock* ./
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

RUN bun run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV SQLITE_DB_PATH=/app/data/veo-meta.sqlite

# Copy built application
COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Create credentials and data directories
RUN mkdir -p /app/credentials
RUN mkdir -p /app/data

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
CMD ["bun", "run", "server.js"]

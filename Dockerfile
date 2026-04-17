FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock* package-lock.json* ./
RUN npm install

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output (includes Next.js generated server.js)
COPY --from=builder /app/.next/standalone ./

# Copy static files that aren't included in standalone
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy env file
COPY --from=builder /app/.env ./.env

# Copy our Railway wrapper server (overrides the default server.js behavior)
COPY --from=builder /app/railway-server.js ./railway-server.js

USER nextjs

EXPOSE 3000

# Use railway-server.js which sets HOSTNAME=0.0.0.0 then loads Next.js server.js
CMD ["node", "railway-server.js"]

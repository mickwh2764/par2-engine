# PAR(2) Discovery Engine - Docker Container
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM base AS builder
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Unset REPL_ID to skip Replit-specific Vite plugins during build
ENV REPL_ID=""
RUN npm run build && \
    echo "=== Build verification ===" && \
    ls -la dist/ && \
    ls -la dist/public/ && \
    test -f dist/index.cjs && \
    test -f dist/public/index.html && \
    echo "=== Build successful ==="

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=5000
ENV HOST=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 par2user

COPY --from=builder --chown=par2user:nodejs /app/dist ./dist
COPY --from=deps --chown=par2user:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=par2user:nodejs /app/package.json ./package.json
COPY --from=builder --chown=par2user:nodejs /app/datasets ./datasets

RUN mkdir -p /app/findings_export /app/manuscripts /app/paper /app/scripts /app/data/local \
 && chown -R par2user:nodejs /app/findings_export /app/manuscripts /app/paper /app/scripts /app/data

USER par2user
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/config', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))" || exit 1

CMD ["node", "dist/index.cjs"]

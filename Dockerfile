# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/graceful-server.js ./graceful-server.js

RUN addgroup -S app && adduser -S app -G app
USER app
# The HEALTHCHECK now uses the standard Authorization header to pass the secret token.
# The $HEALTHCHECK_TOKEN variable must be available in the container's environment.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --header="Authorization: Bearer $HEALTHCHECK_TOKEN" -qO- http://localhost:3000/api/health || exit 1
EXPOSE 3000
CMD ["node", "graceful-server.js"]

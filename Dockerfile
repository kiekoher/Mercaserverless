# Stage 1: Install dependencies
# MEJORA: Actualizado a Node.js 20 para evitar la advertencia de obsolescencia.
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build the application
# MEJORA: Actualizado a Node.js 20.
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package-lock.json ./package-lock.json
COPY . .

# Build without inlining secretos; las variables se proveerán en runtime
RUN npm run build

# Stage 3: Production image
# MEJORA: Actualizado a Node.js 20.
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nextjs
RUN adduser --system --uid 1001 nextjs

# Copy only the necessary files from the builder stage
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000
HEALTHCHECK CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]

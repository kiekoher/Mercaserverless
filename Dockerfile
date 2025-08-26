# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The build command will automatically leverage the .env.production file if it exists
# We will pass production environment variables during runtime, not build time.
RUN npm run build

# Stage 3: Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# The app will not start if the healthcheck token is not set, as per our env validation.
# We set a default here, but it MUST be overridden in docker-compose.prod.yml for security.
ENV HEALTHCHECK_TOKEN=please-change-me

# Copy the standalone output from the builder stage.
# This includes the server and all necessary node_modules.
COPY --from=builder /app/.next/standalone ./
# Copy the public folder for static assets like images.
COPY --from=builder /app/public ./public

# Expose the port the app runs on
EXPOSE 3000

# The command to run the standalone server with graceful shutdown handling
CMD ["node", "graceful-server.js"]

# Healthcheck to ensure the application is running
# This makes a request to the internal healthcheck endpoint.
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health?token=${HEALTHCHECK_TOKEN} || exit 1

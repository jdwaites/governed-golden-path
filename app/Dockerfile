# Demo Node.js Application for GitHub Copilot EKS Demo
FROM node:22-alpine

# Pick up patched Alpine OS packages (e.g. openssl) not yet baked into the
# upstream node:22-alpine layer at the time it was published.
RUN apk update && apk upgrade --no-cache

# The base image also bundles an npm CLI whose own vendored dependencies
# (e.g. npm's internal `tar` package) lag behind fixed versions — apk can't
# touch those since they're not OS packages. Update npm itself to pull them.
RUN npm install -g npm@latest

# Build arguments for version tracking
ARG APP_VERSION=1.0
ARG BUILD_SHA=unknown

# Set as environment variables
ENV APP_VERSION=$APP_VERSION
ENV BUILD_SHA=$BUILD_SHA

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (no lockfile required)
RUN npm install --omit=dev

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the application
CMD ["npm", "start"]
FROM node:24-slim AS builder

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace root configs for pnpm workspace resolution
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy webapp package.json for dependency resolution
COPY src/webapp/package.json src/webapp/package.json

# Install only webapp dependencies
RUN pnpm install --frozen-lockfile --filter webapp

# Copy webapp source code
COPY src/webapp/ src/webapp/

# VITE environment variables (baked at build time)
ARG VITE_COGNITO_USER_POOL_ID
ARG VITE_COGNITO_CLIENT_ID
ARG VITE_COGNITO_REGION
ARG VITE_COGNITO_DOMAIN
ARG VITE_COGNITO_AZURE_AD_IDP_NAME
ARG VITE_API_BASE_URL

# Build the webapp
RUN pnpm --filter webapp build

FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration
COPY src/webapp/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/src/webapp/dist /usr/share/nginx/html

EXPOSE 80

# Health check using wget (available in alpine)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]

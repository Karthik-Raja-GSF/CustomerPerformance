FROM node:20-slim

# Install OpenSSL for Prisma and curl for health checks
RUN apt-get update && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

WORKDIR /app

# Copy package files (from project root context)
COPY src/backend/package.json ./
COPY src/backend/prisma ./prisma/

# Install dependencies using pnpm
RUN pnpm install --no-frozen-lockfile

# Generate Prisma client
RUN pnpm prisma generate

# Copy tsconfig.base.json from project root
COPY tsconfig.base.json ./tsconfig.base.json

# Copy source code
COPY src/backend/ .

# Fix tsconfig.json extends path for Docker context (change ../../tsconfig.base.json to ./tsconfig.base.json)
RUN sed -i 's|"extends": "../../tsconfig.base.json"|"extends": "./tsconfig.base.json"|g' tsconfig.json

# Build TypeScript
RUN pnpm build

# Copy non-TS config files to dist (TypeScript doesn't copy .md files)
RUN cp -r src/config dist/

EXPOSE 8887

# Run migrations and start the server
# Build DATABASE_URL from env vars before running Prisma
CMD ["sh", "-c", "export DATABASE_URL=postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT:-5432}/${DB_NAME:-ait_procurement} && pnpm prisma migrate deploy && node dist/index.js"]

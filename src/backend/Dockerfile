FROM node:20-slim

# Install OpenSSL for Prisma and curl for health checks
RUN apt-get update && apt-get install -y openssl curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files (from project root context)
COPY src/backend/package.json ./
COPY src/backend/prisma ./prisma/

# Install dependencies using npm (no lockfile dependency issues)
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy tsconfig.base.json from project root
COPY tsconfig.base.json ./tsconfig.base.json

# Copy source code
COPY src/backend/ .

# Fix tsconfig.json extends path for Docker context (change ../../tsconfig.base.json to ./tsconfig.base.json)
RUN sed -i 's|"extends": "../../tsconfig.base.json"|"extends": "./tsconfig.base.json"|g' tsconfig.json

# Build TypeScript
RUN npm run build

# Copy non-TS config files to dist (TypeScript doesn't copy .md files)
RUN cp -r src/config dist/

EXPOSE 8887

# Run migrations and start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]

FROM node:20-slim

# Install OpenSSL for Prisma (Debian slim already has compatible version)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json ./
COPY prisma ./prisma/

# Install dependencies using npm (no lockfile dependency issues)
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy tsconfig.base.json to /app
COPY tsconfig.base.json ./tsconfig.base.json

# Copy source code
COPY . .

# Fix tsconfig.json extends path for Docker context (change ../../tsconfig.base.json to ./tsconfig.base.json)
RUN sed -i 's|"extends": "../../tsconfig.base.json"|"extends": "./tsconfig.base.json"|g' tsconfig.json

# Build TypeScript
RUN npm run build

EXPOSE 8887

CMD ["node", "dist/index.js"]

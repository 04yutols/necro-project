# Stage 1: Base
FROM node:20-slim AS base
RUN apt-get update && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Stage 2: Dependencies
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm install

# Stage 3: Build
FROM base AS builder
COPY . .
COPY --from=deps /app/node_modules ./node_modules
# Generate Prisma client explicitly
RUN npx prisma generate
RUN npm run build

# Stage 4: Production
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
# Run migration and start app
CMD npx prisma db push && npm run start

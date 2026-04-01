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
# Copy source files
COPY . .
# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
# Generate Prisma client
RUN npx prisma generate
# Build Next.js app (Ensure a fresh build)
RUN rm -rf .next && npm run build

# Stage 4: Production
FROM base AS runner
ENV NODE_ENV=production
# Next.js production server needs these
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000
# Run migration and start app
CMD npx prisma db push && npm run start

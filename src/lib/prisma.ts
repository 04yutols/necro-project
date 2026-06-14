import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';

// ローカル開発・Jest 実行時は Neon WebSocket ポリフィルが必要
if (process.env.NODE_ENV !== 'production') {
  // Next.js bundles ws optional native modules as ignored stubs in route handlers.
  // Force the pure JS fallback so ws does not call bufferutil.mask on an empty stub.
  process.env.WS_NO_BUFFER_UTIL = '1';
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  neonConfig.webSocketConstructor = require('ws');
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter } as any);
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

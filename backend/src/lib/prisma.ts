import { PrismaClient } from '@prisma/client';

// Shared PrismaClient singleton to avoid exhausting database connection pools.
// Every file that needs Prisma should import from here instead of creating new PrismaClient().

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

import { PrismaClient } from '@prisma/client';

// Единый экземпляр Prisma на всё приложение.
export const prisma = new PrismaClient();

import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
	prisma?: PrismaClient;
};

function createPrismaClient() {
	const databaseUrl = process.env.DATABASE_URL;

	if (!databaseUrl) {
		throw new Error("DATABASE_URL is required to initialize Prisma.");
	}

	if (databaseUrl.startsWith("prisma+postgres://")) {
		return new PrismaClient({
			accelerateUrl: databaseUrl,
		});
	}

	const adapter = new PrismaPg({
		connectionString: databaseUrl,
	});

	return new PrismaClient({ adapter });
}

// local development caching (in dev server reload many times)
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
}

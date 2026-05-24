import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
	prisma?: PrismaClient;
};

const PRISMA_MODEL_DELEGATES = [
	"pendingLiveblocksCleanup",
	"project",
	"projectSpec",
	"projectCollaborator",
	"taskRun",
] as const;

function createPrismaClient() {
	const databaseUrl = process.env.DATABASE_URL;

	if (!databaseUrl) {
		throw new Error("DATABASE_URL is required to initialize Prisma.");
	}

	if (
		databaseUrl.startsWith("prisma://") ||
		databaseUrl.startsWith("prisma+postgres://")
	) {
		return new PrismaClient({
			accelerateUrl: databaseUrl,
		});
	}

	const adapter = new PrismaPg({
		connectionString: databaseUrl,
	});

	return new PrismaClient({ adapter });
}

function hasCurrentModelDelegates(client: PrismaClient): boolean {
	const candidate = client as PrismaClient &
		Partial<Record<(typeof PRISMA_MODEL_DELEGATES)[number], unknown>>;

	return PRISMA_MODEL_DELEGATES.every(
		(delegate) => candidate[delegate] !== undefined,
	);
}

if (globalForPrisma.prisma && !hasCurrentModelDelegates(globalForPrisma.prisma)) {
	void globalForPrisma.prisma.$disconnect().catch(() => undefined);
	globalForPrisma.prisma = undefined;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
}

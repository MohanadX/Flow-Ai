import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { Prisma } from "@/app/generated/prisma/client";
import { ApiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CLERK_USER_LIST_LIMIT = 500;

export interface CollaboratorDto {
	email: string;
	name: string | null;
	imageUrl: string | null;
	addedAt: string;
}

export interface OwnerDto {
	userId: string;
	email: string;
	name: string | null;
	imageUrl: string | null;
}

export interface CollaboratorListDto {
	owner: OwnerDto;
	collaborators: CollaboratorDto[];
}

export function normalizeCollaboratorEmail(email: unknown): string {
	if (typeof email !== "string" || !email.trim()) {
		throw new ApiError(400, "BAD_REQUEST", "Email is required.");
	}
	const normalized = email.trim().toLowerCase();
	if (!EMAIL_PATTERN.test(normalized)) {
		throw new ApiError(400, "BAD_REQUEST", "Email address is not valid.");
	}
	return normalized;
}

export async function assertProjectOwner(
	projectId: string,
	userId: string,
): Promise<void> {
	const project = await prisma.project.findUnique({
		where: { id: projectId },
		select: { ownerId: true },
	});
	if (!project) {
		throw new ApiError(404, "NOT_FOUND", "Project not found.");
	}
	if (project.ownerId !== userId) {
		throw new ApiError(
			403,
			"FORBIDDEN",
			"Only the project owner can manage collaborators.",
		);
	}
}

export async function getCollaborators(
	projectId: string,
	userId: string,
): Promise<CollaboratorListDto> {
	const project = await prisma.project.findUnique({
		where: { id: projectId },
		select: {
			ownerId: true,
			collaborators: {
				orderBy: { createdAt: "asc" },
			},
		},
	});

	if (!project) {
		throw new ApiError(404, "NOT_FOUND", "Project not found.");
	}

	// Check access: must be owner or a collaborator
	const client = await clerkClient();
	const callerUser = await client.users.getUser(userId);
	const callerEmails = callerUser.emailAddresses.map((e) =>
		e.emailAddress.toLowerCase(),
	);

	const isOwner = project.ownerId === userId;
	const isCollaborator = project.collaborators.some((c) =>
		callerEmails.includes(c.email.toLowerCase()),
	);

	if (!isOwner && !isCollaborator) {
		throw new ApiError(403, "FORBIDDEN", "Access denied.");
	}

	// Enrich owner and collaborators with Clerk profile data.
	const collaboratorEmails = project.collaborators.map((c) => c.email);
	const ownerClerkUser = project.ownerId === userId
		? callerUser
		: await client.users.getUser(project.ownerId).catch((error: unknown) => {
				const errorDetails =
					error instanceof Error
						? { message: error.message, stack: error.stack }
						: { message: String(error), stack: undefined };
				console.error("Failed to load ownerClerkUser via client.users.getUser", {
					error: errorDetails,
					ownerId: project.ownerId,
					callerUserId: callerUser.id,
					callerEmails,
				});
				return null;
			});

	const ownerEmail =
		ownerClerkUser?.emailAddresses[0]?.emailAddress ?? "";
	const ownerFirstName = ownerClerkUser?.firstName ?? "";
	const ownerLastName = ownerClerkUser?.lastName ?? "";
	const ownerName =
		[ownerFirstName, ownerLastName].filter(Boolean).join(" ") || null;

	const owner: OwnerDto = {
		userId: project.ownerId,
		email: ownerEmail,
		name: ownerName,
		imageUrl: ownerClerkUser?.imageUrl ?? null,
	};

	const collaborators = await enrichCollaborators(
		project.collaborators,
		collaboratorEmails.length > 0 ? client : null,
	);

	return { owner, collaborators };
}

export async function addCollaborator(
	projectId: string,
	email: string,
): Promise<CollaboratorDto> {
	// Check project exists and get owner email to prevent self-invite issues
	const project = await prisma.project.findUnique({
		where: { id: projectId },
		select: { ownerId: true },
	});
	if (!project) {
		throw new ApiError(404, "NOT_FOUND", "Project not found.");
	}

	try {
		const collaborator = await prisma.projectCollaborator.create({
			data: { projectId, email },
		});
		const [enriched] = await enrichCollaborators([collaborator]);
		return enriched;
	} catch (err) {
		if (
			err instanceof Prisma.PrismaClientKnownRequestError &&
			err.code === "P2002"
		) {
			throw new ApiError(
				409,
				"ALREADY_COLLABORATOR",
				"This email is already a collaborator on this project.",
			);
		}
		throw err;
	}
}

export async function removeCollaborator(
	projectId: string,
	email: string,
): Promise<void> {
	const deleted = await prisma.projectCollaborator.deleteMany({
		where: { projectId, email: email.toLowerCase() },
	});
	if (deleted.count === 0) {
		throw new ApiError(404, "NOT_FOUND", "Collaborator not found.");
	}
}

// Enrich a list of collaborator DB records with Clerk display name and avatar.
async function enrichCollaborators(
	collaborators: { email: string; createdAt: Date }[],
	client: Awaited<ReturnType<typeof clerkClient>> | null = null,
): Promise<CollaboratorDto[]> {
	if (collaborators.length === 0) return [];

	const resolvedClient = client ?? (await clerkClient());

	// Fetch matching Clerk users in bounded batches and build a lookup map.
	const clerkByEmail = new Map<
		string,
		{ name: string | null; imageUrl: string }
	>();
	const collaboratorEmails = Array.from(
		new Set(collaborators.map((c) => c.email.toLowerCase())),
	);

	for (
		let offset = 0;
		offset < collaboratorEmails.length;
		offset += CLERK_USER_LIST_LIMIT
	) {
		const clerkUsers = await resolvedClient.users.getUserList({
			emailAddress: collaboratorEmails.slice(
				offset,
				offset + CLERK_USER_LIST_LIMIT,
			),
			limit: CLERK_USER_LIST_LIMIT,
		});

		for (const u of clerkUsers.data) {
			for (const emailObj of u.emailAddresses) {
				const email = emailObj.emailAddress.toLowerCase();
				const firstName = u.firstName ?? "";
				const lastName = u.lastName ?? "";
				const name = [firstName, lastName].filter(Boolean).join(" ") || null;
				clerkByEmail.set(email, { name, imageUrl: u.imageUrl });
			}
		}
	}

	return collaborators.map((c) => {
		const clerk = clerkByEmail.get(c.email.toLowerCase());
		return {
			email: c.email,
			name: clerk?.name ?? null,
			imageUrl: clerk?.imageUrl ?? null,
			addedAt: c.createdAt.toISOString(),
		};
	});
}

import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { Prisma } from "@/app/generated/prisma/client";
import { ApiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "./pusher-server";
import { serializeProject } from "./project-service";
import { getUserProjectsChannel } from "@/lib/utils";
import {
	collaboratorsLimit,
	type Collaborator,
	type CollaboratorListResponse,
	type Owner,
} from "@/types/collaborator";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CLERK_USER_LIST_LIMIT = 500;

export type CollaboratorDto = Collaborator;
export type OwnerDto = Owner;
export type CollaboratorListDto = CollaboratorListResponse;

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
	page: number = 1,
): Promise<CollaboratorListDto> {
	const project = await prisma.project.findUnique({
		where: { id: projectId },
		select: { ownerId: true },
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
	const collaboratorAccess = isOwner
		? null
		: await prisma.projectCollaborator.findFirst({
				where: { projectId, email: { in: callerEmails } },
				select: { id: true },
			});
	const isCollaborator = !!collaboratorAccess;

	if (!isOwner && !isCollaborator) {
		throw new ApiError(403, "FORBIDDEN", "Access denied.");
	}

	const [projectCollaborators, collaboratorCount] = await Promise.all([
		prisma.projectCollaborator.findMany({
			where: { projectId },
			orderBy: { createdAt: "asc" },
			take: collaboratorsLimit,
			skip: (page - 1) * collaboratorsLimit,
		}),
		prisma.projectCollaborator.count({ where: { projectId } }),
	]);

	// Enrich owner and collaborators with Clerk profile data.
	const collaboratorEmails = projectCollaborators.map((c) => c.email);
	const ownerClerkUser =
		project.ownerId === userId
			? callerUser
			: await client.users.getUser(project.ownerId).catch((error: unknown) => {
					const errorDetails =
						error instanceof Error
							? { message: error.message, stack: error.stack }
							: { message: String(error), stack: undefined };
					console.error(
						"Failed to load ownerClerkUser via client.users.getUser",
						{
							error: errorDetails,
							ownerId: project.ownerId,
							callerUserId: callerUser.id,
							callerEmails,
						},
					);
					return null;
				});

	const ownerEmail = ownerClerkUser?.emailAddresses[0]?.emailAddress ?? "";
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
		projectCollaborators,
		collaboratorEmails.length > 0 ? client : null,
	);

	return { owner, collaborators, collaboratorCount };
}

export async function addCollaborator(
	projectId: string,
	email: string,
): Promise<CollaboratorDto> {
	// Check project exists to prevent self-invite issues and get full project data
	const project = await prisma.project.findUnique({
		where: { id: projectId },
	});
	if (!project) {
		throw new ApiError(404, "NOT_FOUND", "Project not found.");
	}

	try {
		const collaborator = await prisma.projectCollaborator.create({
			data: { projectId, email },
		});
		const enrichedRes = enrichCollaborators([collaborator]);

		// Trigger live update 
		try {
			const serializedProject = serializeProject(project, ""); // pass empty string for currentUserId so isOwner is false
			await pusherServer.trigger(
				getUserProjectsChannel(email),
				"project-shared",
				{ project: serializedProject }
			);
		} catch (publishErr) {
			// Don't fail the whole request if Pusher fails
			console.error("Failed to broadcast project-shared event:", publishErr);
		}

		const [enriched] = await enrichedRes
		if (!enriched) {
			throw new ApiError(
				500,
				"COLLABORATOR_ENRICHMENT_FAILED",
				"Failed to resolve the invited collaborator.",
			);
		}

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

/**  Enrich a list of collaborator DB records with Clerk display name and avatar.
 */
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
	); // normalize & deduplicate

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

		// build the look up table with the clerk data
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

import "server-only";

import {
	Prisma,
	type Project as PrismaProject,
} from "@/app/generated/prisma/client";
import { ApiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import type { Project, ProjectLists } from "@/types/project";

const DEFAULT_PROJECT_NAME = "Untitled Project";
const PROJECT_NAME_MAX_LENGTH = 50;
const PROJECT_ID_MAX_LENGTH = 80;
const PROJECT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type ProjectDto = Project;

export function normalizeCreateProjectName(name: unknown): string {
	if (name === undefined) {
		return DEFAULT_PROJECT_NAME;
	}

	if (typeof name !== "string") {
		throw new ApiError(400, "BAD_REQUEST", "Project name must be a string.");
	}

	const trimmedName = name.trim();
	return validateProjectName(trimmedName || DEFAULT_PROJECT_NAME);
}

export function normalizeRenameProjectName(name: unknown): string {
	if (typeof name !== "string") {
		throw new ApiError(400, "BAD_REQUEST", "Project name is required.");
	}

	return validateProjectName(name.trim());
}

export function normalizeCreateProjectId(
	projectId: unknown,
): string | undefined {
	if (projectId === undefined) {
		return undefined;
	}

	if (typeof projectId !== "string") {
		throw new ApiError(400, "BAD_REQUEST", "Project ID must be a string.");
	}

	return validateProjectId(projectId.trim());
}

export async function listProjects(ownerId: string): Promise<ProjectDto[]> {
	const projects = await prisma.project.findMany({
		where: { ownerId },
		orderBy: { createdAt: "desc" },
	});

	return projects.map((project) => serializeProject(project, ownerId));
	// even though we already fetch projects by userId but for consistency we use ownerId
}

export async function listProjectGroups(
	userId: string,
	emailAddresses: string[],
): Promise<ProjectLists> {
	const normalizedEmails = emailAddresses
		.map((email) => email.trim().toLowerCase())
		.filter(Boolean);
	// .filter((value) => Boolean(value))

	const projects = await prisma.project.findMany({
		where: {
			OR: [
				{ ownerId: userId },
				...(normalizedEmails.length > 0
					? [{ collaborators: { some: { email: { in: normalizedEmails } } } }]
					: []),
			],
		},
		orderBy: { createdAt: "desc" },
	});

	const serializedProjects = projects.map((project) =>
		serializeProject(project, userId),
	);

	return {
		ownedProjects: serializedProjects.filter((project) => project.isOwner),
		sharedProjects: serializedProjects.filter((project) => !project.isOwner),
	};
}

export async function createProject(
	ownerId: string,
	name: string,
	projectId?: string,
): Promise<ProjectDto> {
	try {
		const project = await prisma.project.create({
			data: {
				...(projectId ? { id: projectId } : {}),
				ownerId,
				name,
			},
		});

		return serializeProject(project, ownerId);
	} catch (error) {
		if (isProjectIdConflict(error)) {
			throw new ApiError(
				409,
				"PROJECT_ID_CONFLICT",
				"Project room ID already exists.",
			);
		}

		throw error;
	}
}

export async function renameProject(
	projectId: string,
	ownerId: string,
	name: string,
): Promise<ProjectDto> {
	await assertProjectOwner(projectId, ownerId);

	const project = await prisma.project.update({
		where: { id: projectId },
		data: { name },
	});

	return serializeProject(project, ownerId);
}

export async function deleteProject(
	projectId: string,
	ownerId: string,
): Promise<ProjectDto> {
	await assertProjectOwner(projectId, ownerId);

	const project = await prisma.project.delete({
		where: { id: projectId },
	});

	return serializeProject(project, ownerId);
}

async function assertProjectOwner(
	projectId: string,
	ownerId: string,
): Promise<void> {
	const project = await prisma.project.findUnique({
		where: { id: projectId },
		select: { ownerId: true },
	});

	if (!project) {
		throw new ApiError(404, "NOT_FOUND", "Project not found.");
	}

	if (project.ownerId !== ownerId) {
		throw new ApiError(
			403,
			"FORBIDDEN",
			"Only the project owner can modify this project.",
		);
	}
}

function validateProjectName(name: string): string {
	if (!name) {
		throw new ApiError(400, "BAD_REQUEST", "Project name is required.");
	}

	if (name.length > PROJECT_NAME_MAX_LENGTH) {
		throw new ApiError(
			400,
			"BAD_REQUEST",
			`Project name must be ${PROJECT_NAME_MAX_LENGTH} characters or less.`,
		);
	}

	return name;
}

function validateProjectId(projectId: string): string {
	if (!projectId) {
		throw new ApiError(400, "BAD_REQUEST", "Project ID is required.");
	}

	if (projectId.length > PROJECT_ID_MAX_LENGTH) {
		throw new ApiError(
			400,
			"BAD_REQUEST",
			`Project ID must be ${PROJECT_ID_MAX_LENGTH} characters or less.`,
		);
	}

	if (!PROJECT_ID_PATTERN.test(projectId)) {
		throw new ApiError(
			400,
			"BAD_REQUEST",
			"Project ID must use lowercase letters, numbers, and hyphens.",
		);
	}

	return projectId;
}

function isProjectIdConflict(error: unknown): boolean {
	if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
		return false;
	}

	if (error.code !== "P2002") {
		return false;
	}

	const target = error.meta?.target;

	if (Array.isArray(target)) {
		return target.includes("id");
	}

	return target === "id";
}

function serializeProject(
	project: PrismaProject,
	currentUserId: string,
): ProjectDto {
	return {
		id: project.id,
		roomId: project.id,
		name: project.name,
		slug: slugify(project.name),
		ownerId: project.ownerId,
		isOwner: project.ownerId === currentUserId,
		description: project.description,
		status: project.status,
		canvasJsonPath: project.canvasJsonPath,
		createdAt: project.createdAt.toISOString(),
		updatedAt: project.updatedAt.toISOString(),
	};
}

import { get, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";

import { ApiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma-runtime";

export interface ProjectSpecDto {
	id: string;
	projectId: string;
	filePath: string;
	createdAt: string;
}

export interface SavedProjectSpec {
	spec: ProjectSpecDto;
	content: string;
}

export async function saveGeneratedSpec(
	projectId: string,
	content: string,
): Promise<SavedProjectSpec> {
	const specId = randomUUID();
	const normalizedContent = normalizeMarkdownContent(content);
	const blob = await put(`specs/${projectId}/${specId}.md`, normalizedContent, {
		access: "private",
		allowOverwrite: false,
		cacheControlMaxAge: 60,
		contentType: "text/markdown; charset=utf-8",
	});

	const spec = await prisma.projectSpec.create({
		data: {
			id: specId,
			projectId,
			filePath: blob.url,
		},
	});

	return {
		spec: {
			id: spec.id,
			projectId: spec.projectId,
			filePath: spec.filePath,
			createdAt: spec.createdAt.toISOString(),
		},
		content: normalizedContent,
	};
}

export async function loadSpecMarkdown(filePath: string): Promise<string> {
	const blob = await get(filePath, {
		access: "private",
		useCache: false,
	});

	if (!blob || blob.statusCode !== 200 || !blob.stream) {
		throw new ApiError(
			502,
			"SPEC_BLOB_READ_FAILED",
			"Generated spec could not be loaded.",
		);
	}

	return new Response(blob.stream).text();
}

export function markdownAttachmentHeaders(filename: string): Headers {
	return new Headers({
		"Content-Type": "text/markdown; charset=utf-8",
		"Content-Disposition": `attachment; filename="${sanitizeFilename(filename)}"`,
		"Cache-Control": "private, no-store",
	});
}

function normalizeMarkdownContent(content: string): string {
	const normalized = content.trim();

	if (!normalized) {
		throw new Error("Generated spec content cannot be empty.");
	}

	return `${normalized}\n`;
}

function sanitizeFilename(filename: string): string {
	const sanitized = filename
		.replace(/[\u0000-\u001F\u007F]/g, "")
		.replace(/[\\/:*?"<>|]+/g, "-")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.toLowerCase();

	return sanitized || "spec.md";
}

import { ApiError, handleApiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { checkProjectAccess, getCurrentIdentity } from "@/lib/project-access";
import {
	loadSpecMarkdown,
	markdownAttachmentHeaders,
} from "@/lib/spec-service";
import { slugify } from "@/lib/utils";

interface SpecDownloadRouteContext {
	params: Promise<{ projectId: string; specId: string }>;
}

export async function GET(
	_request: Request,
	{ params }: SpecDownloadRouteContext,
): Promise<Response> {
	try {
		const { projectId, specId } = await params;
		const [project, spec] = await Promise.all([
			requireAccessibleProject(projectId),
			prisma.projectSpec.findFirst({
				where: {
					id: specId,
					projectId,
				},
				select: {
					id: true,
					filePath: true,
					createdAt: true,
				},
			})
		]);

		if (!spec) {
			throw new ApiError(404, "SPEC_NOT_FOUND", "Spec not found.");
		}

		const markdown = await loadSpecMarkdown(spec.filePath);
		const createdDate = spec.createdAt.toISOString().slice(0, 10);
		const filename = `${slugify(project.name)}-${createdDate}-${spec.id}.md`;

		return new Response(markdown, {
			status: 200,
			headers: markdownAttachmentHeaders(filename),
		});
	} catch (error) {
		return handleApiError(error);
	}
}

async function requireAccessibleProject(projectId: string) {
	const identity = await getCurrentIdentity();

	if (!identity) {
		throw new ApiError(401, "UNAUTHORIZED", "Authentication required.");
	}

	const project = await checkProjectAccess(projectId, identity);

	if (!project) {
		throw new ApiError(404, "NOT_FOUND", "Project not found.");
	}

	return project;
}

import { requireUserId } from "@/lib/api-auth";
import { handleApiError, readJsonObject } from "@/lib/api-response";
import {
	deleteProject,
	normalizeRenameProjectName,
	renameProject,
} from "@/lib/project-service";

interface ProjectRouteContext {
	params: Promise<{
		projectId: string;
	}>;
}

export async function PATCH(request: Request, { params }: ProjectRouteContext) {
	try {
		const userId = await requireUserId();
		const { projectId } = await params;
		const body = await readJsonObject(request);
		const name = normalizeRenameProjectName(body.name);
		const project = await renameProject(projectId, userId, name);

		return Response.json({ project });
	} catch (error) {
		return handleApiError(error);
	}
}

export async function DELETE(_request: Request, { params }: ProjectRouteContext) {
	try {
		const userId = await requireUserId();
		const { projectId } = await params;
		const project = await deleteProject(projectId, userId);

		return Response.json({ project });
	} catch (error) {
		return handleApiError(error);
	}
}

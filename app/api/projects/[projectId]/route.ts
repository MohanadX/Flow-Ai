import { requireUserId } from "@/lib/api-auth";
import { handleApiError, readJsonObject } from "@/lib/api-response";
import {
	deleteProject,
	normalizeRenameProjectName,
	renameProject,
	serializeProject,
} from "@/lib/project-service";
import { checkProjectAccess, getCurrentIdentity } from "@/lib/project-access";

interface ProjectRouteContext {
	params: Promise<{
		projectId: string;
	}>;
}

export async function GET(_: Request, { params }: ProjectRouteContext) {
	try {
		const identity = await getCurrentIdentity();
		if (!identity) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { projectId } = await params;
		const accessResult = await checkProjectAccess(projectId, identity);

		if (!accessResult) {
			return Response.json(
				{ error: "Project not found or access denied" },
				{ status: 404 },
			);
		}

		const project = serializeProject(accessResult, identity.userId);
		return Response.json({ project });
	} catch (error) {
		return handleApiError(error);
	}
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

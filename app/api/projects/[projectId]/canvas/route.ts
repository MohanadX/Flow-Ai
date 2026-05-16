import { ApiError, handleApiError, readJsonObject } from "@/lib/api-response";
import {
	loadCanvasSnapshot,
	parseCanvasSnapshotInput,
	saveCanvasSnapshot,
} from "@/lib/canvas-service";
import { checkProjectAccess, getCurrentIdentity } from "@/lib/project-access";

interface CanvasRouteContext {
	params: Promise<{ projectId: string }>;
}

export async function GET(_request: Request, { params }: CanvasRouteContext) {
	try {
		const { projectId } = await params;
		const project = await requireAccessibleProject(projectId);
		const canvas = await loadCanvasSnapshot(project.canvasJsonPath);

		return Response.json({
			canvas,
			canvasJsonPath: project.canvasJsonPath,
		});
	} catch (error) {
		return handleApiError(error);
	}
}

export async function PUT(request: Request, { params }: CanvasRouteContext) {
	try {
		const { projectId } = await params;
		await requireAccessibleProject(projectId);

		const body = await readJsonObject(request);
		const canvas = parseCanvasSnapshotInput(body);
		const result = await saveCanvasSnapshot(projectId, canvas);

		return Response.json(result);
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

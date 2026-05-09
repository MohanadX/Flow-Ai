import { requireUserId } from "@/lib/api-auth";
import { handleApiError, readJsonObject } from "@/lib/api-response";
import {
	createProject,
	listProjects,
	normalizeCreateProjectId,
	normalizeCreateProjectName,
} from "@/lib/project-service";

export async function GET() {
	try {
		const userId = await requireUserId();
		const projects = await listProjects(userId);

		return Response.json({ projects });
	} catch (error) {
		return handleApiError(error);
	}
}

export async function POST(request: Request) {
	try {
		const userId = await requireUserId();
		const body = await readJsonObject(request);
		const name = normalizeCreateProjectName(body.name);
		const projectId = normalizeCreateProjectId(body.id);
		const project = await createProject(userId, name, projectId);

		return Response.json({ project }, { status: 201 });
	} catch (error) {
		return handleApiError(error);
	}
}

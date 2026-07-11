import { requireUserId } from "@/lib/api-auth";
import { handleApiError, readJsonObject } from "@/lib/api-response";
import {
	createProject,
	listProjects,
	normalizeCreateProjectId,
	normalizeCreateProjectName,
} from "@/lib/project-service";

export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url)
		const parsedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
		const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1; // safe guard
		const userId = await requireUserId();
		const projects = await listProjects(userId, page);

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

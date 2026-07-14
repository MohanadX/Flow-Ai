import { getUserProjectsTag } from "@/cache/projects";
import { requireUserId } from "@/lib/api-auth";
import { handleApiError, readJsonObject } from "@/lib/api-response";
import {
	createProject,
	listProjects,
	normalizeCreateProjectId,
	normalizeCreateProjectName,
} from "@/lib/project-service";
import { revalidateTag } from "next/cache";

export async function GET(request: Request) {
	try {
		const userReq = requireUserId()
		const { searchParams } = new URL(request.url)
		const parsedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
		const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1; // safe guard
		const userId = await userReq
		const projects = await listProjects(userId, page);

		return Response.json({ projects });
	} catch (error) {
		return handleApiError(error);
	}
}

export async function POST(request: Request) {
	try {
		const [userId, body] = await Promise.all([
			requireUserId(),
			readJsonObject(request)
		])

		const [name, projectId] = await Promise.all([
			normalizeCreateProjectName(body.name),
			normalizeCreateProjectId(body.id)
		])

		const project = await createProject(userId, name, projectId);

		revalidateTag(getUserProjectsTag(userId), "max")

		return Response.json({ project }, { status: 201 });
	} catch (error) {
		return handleApiError(error);
	}
}

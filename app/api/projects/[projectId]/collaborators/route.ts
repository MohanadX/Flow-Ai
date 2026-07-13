import { requireUserId } from "@/lib/api-auth";
import { handleApiError, readJsonObject } from "@/lib/api-response";
import {
	addCollaborator,
	assertProjectOwner,
	getCollaborators,
	normalizeCollaboratorEmail,
} from "@/lib/collaborator-service";

interface CollaboratorRouteContext {
	params: Promise<{ projectId: string }>;
}

// GET /api/projects/[projectId]/collaborators — list collaborators (owner + collaborators)
export async function GET(
	request: Request,
	{ params }: CollaboratorRouteContext,
) {
	try {
		const { searchParams } = new URL(request.url);
		const parsedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
		const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1; // safe guard
		
		const [userId, { projectId }] = await Promise.all([
			requireUserId(),
			params
		])
		const result = await getCollaborators(projectId, userId, page);

		return Response.json(result);
	} catch (error) {
		return handleApiError(error);
	}
}

// POST /api/projects/[projectId]/collaborators — invite collaborator (owner only)
export async function POST(
	request: Request,
	{ params }: CollaboratorRouteContext,
) {
	try {
		const [userId, { projectId }, body] = await Promise.all([
			requireUserId(),	
			params,
			readJsonObject(request)
		])

		await assertProjectOwner(projectId, userId);

		const email = normalizeCollaboratorEmail(body.email);
		const collaborator = await addCollaborator(projectId, email);

		return Response.json({ collaborator }, { status: 201 });
	} catch (error) {
		return handleApiError(error);
	}
}

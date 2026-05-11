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
	_request: Request,
	{ params }: CollaboratorRouteContext,
) {
	try {
		const userId = await requireUserId();
		const { projectId } = await params;
		const result = await getCollaborators(projectId, userId);

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
		const userId = await requireUserId();
		const { projectId } = await params;
		await assertProjectOwner(projectId, userId);

		const body = await readJsonObject(request);
		const email = normalizeCollaboratorEmail(body.email);
		const collaborator = await addCollaborator(projectId, email);

		return Response.json({ collaborator }, { status: 201 });
	} catch (error) {
		return handleApiError(error);
	}
}

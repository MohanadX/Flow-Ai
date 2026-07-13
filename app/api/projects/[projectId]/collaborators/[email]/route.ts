import { requireUserId } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-response";
import {
	assertProjectOwner,
	removeCollaborator,
} from "@/lib/collaborator-service";
import { pusherServer } from "@/lib/pusher-server";
import { getUserProjectsChannel } from "@/lib/utils";

interface CollaboratorItemRouteContext {
	params: Promise<{ projectId: string; email: string }>;
}

// DELETE /api/projects/[projectId]/collaborators/[email] — remove collaborator (owner only)
export async function DELETE(
	_request: Request,
	{ params }: CollaboratorItemRouteContext,
) {
	try {
		const [userId, { projectId, email }] = await Promise.all([
			requireUserId(),
			params,
		])

		await assertProjectOwner(projectId, userId);

		const decodedEmail = decodeURIComponent(email); // to decode the url email special characters encoding
		await removeCollaborator(projectId, decodedEmail);

		// pusher live update

		await pusherServer.trigger(
			getUserProjectsChannel(decodedEmail),
			"project-removed",
			{ id: projectId }
		)

		return Response.json({ success: true });
	} catch (error) {
		return handleApiError(error);
	}
}

import { requireUserId } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-response";
import { getCachedClerkUser } from "@/lib/clerk-cache";
import { listProjectGroups } from "@/lib/project-service";

// GET /api/projects/shared — returns projects the current user is a collaborator on (not owner)
export async function GET() {
	try {
		const userId = await requireUserId();
		const user = await getCachedClerkUser(userId);
		const { sharedProjects } = await listProjectGroups(
			userId,
			user.emailAddresses,
		);

		return Response.json({ projects: sharedProjects });
	} catch (error) {
		return handleApiError(error);
	}
}

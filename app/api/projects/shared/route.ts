import { requireUserId } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-response";
import { getCachedClerkUser } from "@/lib/clerk-cache";
import { listSharedProjects } from "@/lib/project-service";

// GET /api/projects/shared — returns projects the current user is a collaborator on (not owner)
export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url)
		const parsedPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
		const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1; // safe guard
		const userId = await requireUserId();
		const user = await getCachedClerkUser(userId);
		const sharedProjects = await listSharedProjects(
			userId,
			user.emailAddresses,
			page
		);

		return Response.json({ projects: sharedProjects });
	} catch (error) {
		return handleApiError(error);
	}
}

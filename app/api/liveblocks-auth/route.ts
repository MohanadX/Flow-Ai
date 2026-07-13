import { ApiError, handleApiError, readJsonObject } from "@/lib/api-response";
import { getCursorColorForUser, getLiveblocksClient } from "@/lib/liveblocks";
import { checkProjectAccess } from "@/lib/project-access";
import { getCachedClerkUser } from "@/lib/clerk-cache";
import { requireUserId } from "@/lib/api-auth";

export async function POST(request: Request) {
	try {
		// Resolve auth identity and request body concurrently.
		const [userId, body] = await Promise.all([
			requireUserId(),
			readJsonObject(request),
		]);

		if (!userId) {
			throw new ApiError(401, "UNAUTHORIZED", "Authentication required.");
		}

		// Retrieve cached user profile details to avoid slow Clerk roundtrips.
		const roomId = normalizeRoomId(body.room);
		const cachedUser = await getCachedClerkUser(userId);
		const email = cachedUser.email;
		const project = await checkProjectAccess(roomId, { userId, email });

		if (!project) {
			throw new ApiError(403, "FORBIDDEN", "Access denied.");
		}

		const cursorColor = getCursorColorForUser(userId);
		const liveblocks = getLiveblocksClient();

		const session = liveblocks.prepareSession(userId, {
			userInfo: {
				displayName: cachedUser.displayName,
				avatarUrl: cachedUser.avatarUrl,
				cursorColor,
			},
		});

		session.allow(roomId, session.FULL_ACCESS);

		const [, authResponse] = await Promise.all([
			liveblocks.getOrCreateRoom(roomId, {
				defaultAccesses: [],
				metadata: {
					projectId: project.id,
					projectName: project.name,
				},
			}),
			session.authorize(),
		]);


		const { status, body: responseBody } = authResponse;
		return new Response(responseBody, { status });
	} catch (error) {
		return handleApiError(error);
	}
}

function normalizeRoomId(room: unknown): string {
	if (typeof room !== "string" || !room.trim()) {
		throw new ApiError(400, "BAD_REQUEST", "Room ID is required.");
	}

	return room.trim();
}

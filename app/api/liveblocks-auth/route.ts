import { auth } from "@clerk/nextjs/server";

import { ApiError, handleApiError, readJsonObject } from "@/lib/api-response";
import { getCursorColorForUser, getLiveblocksClient } from "@/lib/liveblocks";
import { checkProjectAccess } from "@/lib/project-access";
import { getCachedClerkUser } from "@/lib/clerk-cache";

export async function POST(request: Request) {
	try {
		// Resolve auth identity and request body concurrently.
		const [{ userId }, body] = await Promise.all([
			auth(),
			readJsonObject(request),
		]);

		if (!userId) {
			throw new ApiError(401, "UNAUTHORIZED", "Authentication required.");
		}

		// Retrieve cached user profile details to avoid slow Clerk roundtrips.
		const cachedUser = await getCachedClerkUser(userId);
		const roomId = normalizeRoomId(body.room);
		const email = cachedUser.email;
		const project = await checkProjectAccess(roomId, { userId, email });

		if (!project) {
			throw new ApiError(403, "FORBIDDEN", "Access denied.");
		}

		const cursorColor = getCursorColorForUser(userId);
		const liveblocks = getLiveblocksClient();

		await liveblocks.getOrCreateRoom(roomId, {
			defaultAccesses: [],
			metadata: {
				projectId: project.id,
				projectName: project.name,
			},
		});

		const session = liveblocks.prepareSession(userId, {
			userInfo: {
				displayName: cachedUser.displayName,
				avatarUrl: cachedUser.avatarUrl,
				cursorColor,
			},
		});

		session.allow(roomId, session.FULL_ACCESS);

		const { status, body: responseBody } = await session.authorize();
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

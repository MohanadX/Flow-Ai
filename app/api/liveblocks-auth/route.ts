import { currentUser, auth } from "@clerk/nextjs/server";

import { ApiError, handleApiError, readJsonObject } from "@/lib/api-response";
import { getCursorColorForUser, getLiveblocksClient } from "@/lib/liveblocks";
import { checkProjectAccess } from "@/lib/project-access";

export async function POST(request: Request) {
	try {
		const { userId } = await auth();

		if (!userId) {
			throw new ApiError(401, "UNAUTHORIZED", "Authentication required.");
		}

		const body = await readJsonObject(request);
		const roomId = normalizeRoomId(body.room);
		const user = await currentUser();
		const email = user?.emailAddresses[0]?.emailAddress ?? null;
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
				displayName: getDisplayName(user, email),
				avatarUrl: user?.imageUrl ?? "",
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

function getDisplayName(
	user: Awaited<ReturnType<typeof currentUser>>,
	email: string | null,
): string {
	if (!user) return email ?? "Anonymous";

	const name = [user.firstName, user.lastName].filter(Boolean).join(" ");

	return name || user.username || email || "Anonymous";
}

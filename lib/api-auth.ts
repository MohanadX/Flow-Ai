import "server-only";

import { auth } from "@clerk/nextjs/server";

import { ApiError } from "@/lib/api-response";

export async function requireUserId(): Promise<string> {
	const { userId } = await auth();

	if (!userId) {
		throw new ApiError(401, "UNAUTHORIZED", "Authentication required.");
	}

	return userId;
}

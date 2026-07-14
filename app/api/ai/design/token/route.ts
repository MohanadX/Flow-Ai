import { auth } from "@trigger.dev/sdk";

import { requireUserId } from "@/lib/api-auth";
import { ApiError, handleApiError, readJsonObject } from "@/lib/api-response";

export async function POST(request: Request): Promise<Response> {
	try {
		const [userId, body] = await Promise.all([
			requireUserId(),
			readJsonObject(request)
		])

		const runId =
			typeof body.runId === "string" ? body.runId.trim() : "";
		const taskUserId =
			typeof body.taskUserId === "string" ? body.taskUserId.trim() : "";

		if (!runId) {
			throw new ApiError(400, "MISSING_RUN_ID", "runId is required.");
		}
	

		if (!taskUserId) {
			throw new ApiError(404, "RUN_NOT_FOUND", "Task run not found.");
		}

		if (taskUserId !== userId) {
			throw new ApiError(
				403,
				"FORBIDDEN",
				"You do not have access to this run.",
			);
		}

		const publicToken = await auth.createPublicToken({
				scopes: {
					read: {
						runs: [runId],
					},
				},
				expirationTime: "1h",
			});

		return Response.json({ token: publicToken });
	} catch (error) {
		return handleApiError(error);
	}
}

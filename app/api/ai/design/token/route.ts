import { auth } from "@trigger.dev/sdk";

import { requireUserId } from "@/lib/api-auth";
import { ApiError, handleApiError, readJsonObject } from "@/lib/api-response";
import { taskMap } from "../route";

export async function POST(request: Request): Promise<Response> {
	try {
		const [userId, body] = await Promise.all([
			requireUserId(),
			readJsonObject(request)
		])

		const runId =
			typeof body.runId === "string" ? body.runId.trim() : "";
		
		if (!runId) {
			throw new ApiError(400, "MISSING_RUN_ID", "runId is required.");
		}
	

		const taskUserId = taskMap().get("checkStatus" + runId)
		
		if (!taskUserId) {
			throw new ApiError(400, "MISSING_TASK_USER_ID", "taskUserId is required.");
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

import { auth } from "@trigger.dev/sdk";

import { requireUserId } from "@/lib/api-auth";
import { ApiError, handleApiError, readJsonObject } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

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

		const taskRun = await prisma.taskRun.findUnique({
			where: { runId },
			select: { userId: true },
		})

		if (!taskRun) {
			throw new ApiError(404, "RUN_NOT_FOUND", "Task run not found.");
		}

		if (taskRun.userId !== userId) {
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

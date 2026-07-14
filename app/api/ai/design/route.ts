import { tasks } from "@trigger.dev/sdk";

import { requireUserId } from "@/lib/api-auth";
import { ApiError, handleApiError, readJsonObject } from "@/lib/api-response";
import { getCachedClerkUser } from "@/lib/clerk-cache";
import { prisma } from "@/lib/prisma";
import { checkProjectAccess } from "@/lib/project-access";
import type { designAgentTask } from "@/trigger/design-agent";

export async function POST(request: Request): Promise<Response> {
	try {
		const [userId, body] = await Promise.all([
			requireUserId(),
			readJsonObject(request)
		])

		const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
		const projectId =
			typeof body.projectId === "string" ? body.projectId.trim() : "";
		const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";

		if (!prompt) {
			throw new ApiError(400, "MISSING_PROMPT", "prompt is required.");
		}
		if (!projectId) {
			throw new ApiError(400, "MISSING_PROJECT_ID", "projectId is required.");
		}
		if (!roomId) {
			throw new ApiError(400, "MISSING_ROOM_ID", "roomId is required.");
		}

		if (roomId !== projectId) {
			throw new ApiError(
				400,
				"PROJECT_ROOM_MISMATCH",
				"roomId must match projectId.",
			);
		}

		const cachedUser = await getCachedClerkUser(userId);
		const project = await checkProjectAccess(projectId, {
			userId,
			email: cachedUser.email,
		});

		if (!project) {
			throw new ApiError(403, "FORBIDDEN", "Access denied.");
		}

		const canonicalProjectId = project.id;

		const handle = await tasks.trigger<typeof designAgentTask>("design-agent", {
			prompt,
			roomId: canonicalProjectId,
		});

		await prisma.taskRun.create({
			data: {
				runId: handle.id,
				projectId: canonicalProjectId,
				userId,
			},
		});

		return Response.json({ runId: handle.id }, { status: 202 });
	} catch (error) {
		return handleApiError(error);
	}
}
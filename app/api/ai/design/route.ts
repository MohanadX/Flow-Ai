import { tasks } from "@trigger.dev/sdk";

import { requireUserId } from "@/lib/api-auth";
import { ApiError, handleApiError, readJsonObject } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import type { designAgentTask } from "@/trigger/design-agent";

export async function POST(request: Request): Promise<Response> {
	try {
		const userId = await requireUserId();
		const body = await readJsonObject(request);

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

		const handle = await tasks.trigger<typeof designAgentTask>("design-agent", {
			prompt,
			roomId,
		});

		await prisma.taskRun.create({
			data: {
				runId: handle.id,
				projectId,
				userId,
			},
		});

		return Response.json({ runId: handle.id }, { status: 202 });
	} catch (error) {
		return handleApiError(error);
	}
}

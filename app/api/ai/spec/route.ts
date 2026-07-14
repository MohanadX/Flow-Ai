import { tasks } from "@trigger.dev/sdk";

import { requireUserId } from "@/lib/api-auth";
import { ApiError, handleApiError, readJsonObject } from "@/lib/api-response";
import { getCachedClerkUser } from "@/lib/clerk-cache";
import { prisma } from "@/lib/prisma";
import { checkProjectAccess } from "@/lib/project-access";
import type { generateSpec } from "@/trigger/generate-spec";
import { generateSpecRequestSchema } from "@/types/spec-generation";

export async function POST(request: Request): Promise<Response> {
	try {
		const [userId, body] = await Promise.all([
			requireUserId(),
			readJsonObject(request)
		])
		const parsed = generateSpecRequestSchema.safeParse(body);

		if (!parsed.success) {
			throw new ApiError(
				400,
				"BAD_REQUEST",
				parsed.error.issues[0]?.message || "Invalid spec generation request.",
			);
		}

		const { roomId, chatHistory, nodes, edges } = parsed.data;
		const cachedUser = await getCachedClerkUser(userId);
		const project = await checkProjectAccess(roomId, {
			userId,
			email: cachedUser.email,
		});

		if (!project) {
			throw new ApiError(403, "FORBIDDEN", "Access denied.");
		}

		const canonicalProjectId = project.id;
		const handle = await tasks.trigger<typeof generateSpec>("generate-spec", {
			projectId: canonicalProjectId,
			roomId: canonicalProjectId,
			chatHistory,
			nodes,
			edges,
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

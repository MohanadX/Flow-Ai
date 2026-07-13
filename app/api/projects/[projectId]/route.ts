import { requireUserId } from "@/lib/api-auth";
import { handleApiError, readJsonObject } from "@/lib/api-response";
import {
	normalizeRenameProjectName,
	renameProject,
	serializeProject,
} from "@/lib/project-service";
import { checkProjectAccess, getCurrentIdentity } from "@/lib/project-access";
import { revalidateTag } from "next/cache";
import { getUserProjectsTag } from "@/cache/projects";
import {  clerkClient } from "@clerk/nextjs/server";
import { after } from "next/server";

interface ProjectRouteContext {
	params: Promise<{
		projectId: string;
	}>;
}

export async function GET(_: Request, { params }: ProjectRouteContext) {
	try {
		const [identity, { projectId }] = await Promise.all([
			getCurrentIdentity(),
			params,
		])
		if (!identity) {
			return Response.json({ error: "Unauthorized" }, { status: 401 });
		}
		const accessResult = await checkProjectAccess(projectId, identity);

		if (!accessResult) {
			return Response.json(
				{ error: "Project not found or access denied" },
				{ status: 404 },
			);
		}

		const project = serializeProject(accessResult, identity.userId);
		return Response.json({ project });
	} catch (error) {
		return handleApiError(error);
	}
}

export async function PATCH(request: Request, { params }: ProjectRouteContext) {
	try {
		const [userId, body, { projectId }] = await Promise.all([
			requireUserId(),
			readJsonObject(request),
			params,
		])
		const name = normalizeRenameProjectName(body.name);
		const { emails, ...project } = await renameProject(projectId, userId, name);

		after(async () => {
			try {
				const client = await clerkClient()
				const allUsersIds = await client.users.getUserList({
					emailAddress: emails,
				});
			
				// revalidate each user cache
				allUsersIds.data.forEach((user) => {
					revalidateTag(getUserProjectsTag(user.id), "max")
				})
			} catch (backgroundError) {
				console.error({
                    event: "project_rename_cache_revalidation_failed",
                    projectId,
                    error: backgroundError,
                });
			}
		})
		return Response.json({ project });
	} catch (error) {
		return handleApiError(error);
	}
}

// export async function DELETE(_request: Request, { params }: ProjectRouteContext) {
// 	try {
// 		const [userId, client,{ projectId }] = await Promise.all([
// 			requireUserId(),
// 			clerkClient(),
// 			params
// 		])
// 		const {emails, ...project} = await deleteProject(projectId, userId);

// 		const allUsersIds = await client.users.getUserList({
// 		emailAddress: emails,
// 	});

// 	// revalidate each user cache
// 	allUsersIds.data.forEach((user) => {
// 		updateTag(getUserProjectsTag(user.id)) // fetch instantly (not lazy)
// 	})

// 		return Response.json({ project });
// 	} catch (error) {
// 		return handleApiError(error);
// 	}
// }

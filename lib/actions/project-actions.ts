"use server"

import { clerkClient } from "@clerk/nextjs/server";
import { requireUserId } from "../api-auth";
import { deleteProject } from "../project-service";
import { updateTag } from "next/cache";
import { getUserProjectsTag } from "@/cache/projects";
import { handleApiError } from "../api-response";

export async function deleteProjectAction(projectId: string) {
    try {
		const [userId, client] = await Promise.all([
			requireUserId(),
			clerkClient()
		])
		const {emails} = await deleteProject(projectId, userId);

		const allUsersIds = await client.users.getUserList({
		emailAddress: emails,
	});

    // updateTag(getUserProjectsTag(project.ownerId))
	// revalidate each user cache
	allUsersIds.data.forEach((user) => {
		updateTag(getUserProjectsTag(user.id)) // fetch instantly (not lazy)
	})
	} catch (error) {
		return handleApiError(error);
	}
}
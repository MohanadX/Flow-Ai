"use server"

import { clerkClient } from "@clerk/nextjs/server";
import { requireUserId } from "../api-auth";
import { deleteProject } from "../project-service";
import { updateTag } from "next/cache";
import { getUserProjectsTag } from "@/cache/projects";

export async function deleteProjectAction(projectId: string) {
    try {
		const [userId, client] = await Promise.all([
			requireUserId(),
			clerkClient()
		])
		const {emails, ...project} = await deleteProject(projectId, userId);

		const allUsersIds = await client.users.getUserList({
		emailAddress: emails,
	});

    updateTag(getUserProjectsTag(project.ownerId))
	// revalidate each user cache
	allUsersIds.data.forEach((user) => {
		updateTag(getUserProjectsTag(user.id)) // fetch instantly (not lazy)
	})

	return {
		project: {
			...project,
			isOwner: project.ownerId === userId
		}
	}
	} catch (error) {
		console.error("Server Action Error:", error);
        throw new Error(error instanceof Error ? error.message : "An unexpected error occurred");
	}
}
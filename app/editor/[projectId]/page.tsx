import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { EditorChrome } from "@/components/editor/editor-chrome";
import { listProjectGroups } from "@/lib/project-service";

interface ProjectWorkspacePageProps {
	params: Promise<{
		projectId: string;
	}>;
}

export default async function ProjectWorkspacePage({
	params,
}: ProjectWorkspacePageProps) {
	const { userId } = await auth();

	if (!userId) {
		redirect("/sign-in");
	}

	const { projectId } = await params;
	const user = await currentUser();
	const projectLists = await listProjectGroups(
		userId,
		user?.emailAddresses.map((email) => email.emailAddress) ?? [],
	);
	const activeProject = [
		...projectLists.ownedProjects,
		...projectLists.sharedProjects,
	].find((project) => project.id === projectId);

	if (!activeProject) {
		redirect("/editor");
	}

	return (
		<EditorChrome {...projectLists} activeProjectId={projectId}>
			<div className="flex h-full flex-col items-center justify-center px-4 text-center">
				<h1 className="text-2xl font-semibold tracking-tight text-copy-primary">
					{activeProject.name}
				</h1>
				<p className="mt-2 max-w-md text-copy-muted">
					Project room {activeProject.roomId}
				</p>
			</div>
		</EditorChrome>
	);
}

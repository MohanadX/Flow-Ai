"use client";

import { ReactNode, useState } from "react";
import { EditorNavbar } from "@/components/editor/editor-navbar";
import { ProjectSidebar } from "@/components/editor/project-sidebar";
import { ProjectDialogs } from "@/components/editor/project-dialogs";
import { Button } from "@/components/ui/button";
import { useProjectActions } from "@/hooks/use-project-actions";
import type { ProjectLists } from "@/types/project";
import { Plus } from "lucide-react";

export function EditorChrome({
	children,
	ownedProjects,
	sharedProjects,
	activeProjectId,
}: {
	children?: ReactNode;
	activeProjectId?: string | null;
} & ProjectLists) {
	const projectActions = useProjectActions({
		ownedProjects,
		sharedProjects,
		activeProjectId,
	});
	const [isSidebarOpen, setIsSidebarOpen] = useState(true);

	return (
		<div className="flex flex-col h-screen overflow-hidden bg-base relative">
			<EditorNavbar
				isSidebarOpen={isSidebarOpen}
				toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
			/>
			<ProjectSidebar
				isOpen={isSidebarOpen}
				onClose={() => setIsSidebarOpen(false)}
				ownedProjects={projectActions.ownedProjects}
				sharedProjects={projectActions.sharedProjects}
				activeProjectId={activeProjectId}
				onNewProject={projectActions.openCreate}
				onOpenProject={projectActions.openProject}
				onRename={projectActions.openRename}
				onDelete={projectActions.openDelete}
			/>
			<ProjectDialogs {...projectActions} />
			<main className="flex-1 overflow-hidden relative">
				{children ?? (
					<EditorHomeEmptyState onNewProject={projectActions.openCreate} />
				)}
			</main>
		</div>
	);
}

function EditorHomeEmptyState({ onNewProject }: { onNewProject: () => void }) {
	return (
		<div className="flex h-full flex-col items-center justify-center px-4 text-center">
			<h1 className="text-2xl font-semibold tracking-tight text-copy-primary">
				Create a project or open an existing one
			</h1>
			<p className="mt-2 max-w-md text-copy-muted">
				Start a new architecture workspace, or choose a project from the
				sidebar.
			</p>
			<Button onClick={onNewProject} className="mt-8" size="lg">
				<Plus className="mr-2 h-5 w-5" />
				New Project
			</Button>
		</div>
	);
}

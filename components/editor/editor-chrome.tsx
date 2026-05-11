"use client";

import { ReactNode, useMemo, useState, createContext } from "react";
import { useParams } from "next/navigation";
import { EditorNavbar } from "@/components/editor/editor-navbar";
import { ProjectSidebar } from "@/components/editor/project-sidebar";
import { ProjectDialogs } from "@/components/editor/project-dialogs";
import { ShareDialog } from "@/components/editor/share-dialog";
import { useProjectActions } from "@/hooks/use-project-actions";
import { cn } from "@/lib/utils";
import type { ProjectLists } from "@/types/project";

export const EditorActionContext = createContext<{ onNewProject: () => void }>({
	onNewProject: () => {},
});

export function EditorChrome({
	children,
	ownedProjects,
	sharedProjects,
}: {
	children?: ReactNode;
} & ProjectLists) {
	const params = useParams<{ projectId?: string }>();
	const activeProjectId = params?.projectId ?? null;

	const projectActions = useProjectActions({
		ownedProjects,
		sharedProjects,
		activeProjectId,
	});
	const [isSidebarOpen, setIsSidebarOpen] = useState(true);
	const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);
	const [isShareOpen, setIsShareOpen] = useState(false);

	const activeProject = useMemo(() => {
		if (!activeProjectId) return null;
		return [...ownedProjects, ...sharedProjects].find(
			(p) => p.id === activeProjectId,
		);
	}, [activeProjectId, ownedProjects, sharedProjects]);

	return (
		<EditorActionContext.Provider
			value={{ onNewProject: projectActions.openCreate }}
		>
			<div className="flex flex-col h-screen overflow-hidden bg-base relative">
				<EditorNavbar
					isSidebarOpen={isSidebarOpen}
					toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
					projectName={activeProject?.name}
					isAiSidebarOpen={isAiSidebarOpen}
					toggleAiSidebar={() => setIsAiSidebarOpen(!isAiSidebarOpen)}
					onShare={activeProject ? () => setIsShareOpen(true) : undefined}
				/>
				<div className="flex flex-1 overflow-hidden relative">
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
					{activeProject && (
						<ShareDialog
							open={isShareOpen}
							onOpenChange={setIsShareOpen}
							projectId={activeProject.id}
							projectName={activeProject.name}
							isOwner={activeProject.isOwner}
						/>
					)}
					<main className="flex-1 justify-center flex overflow-hidden relative">
						{children}
					</main>
					{activeProjectId && (
						<>
							{isAiSidebarOpen && (
								<div
									className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
									onClick={() => setIsAiSidebarOpen(false)}
								/>
							)}
							<div
								className={cn(
									"fixed top-14 bottom-0 right-0 z-40 w-80 shrink-0 transform border-l border-border bg-base transition-all duration-300 ease-in-out flex flex-col items-center justify-center p-4",
									"lg:static lg:top-0 lg:h-full lg:translate-x-0",
									isAiSidebarOpen
										? "translate-x-0 lg:mr-0"
										: "translate-x-full lg:-mr-80 pointer-events-none",
								)}
							>
								<p className="text-copy-muted text-sm">AI Chat Placeholder</p>
							</div>
						</>
					)}
				</div>
			</div>
		</EditorActionContext.Provider>
	);
}

"use client";

import {
	ReactNode,
	useMemo,
	useState,
	createContext,
	useCallback,
	useContext,
} from "react";
import { useParams } from "next/navigation";
import { LiveblocksProvider, RoomProvider } from "@liveblocks/react";
import { EditorNavbar } from "@/components/editor/editor-navbar";
import { ProjectSidebar } from "@/components/editor/project-sidebar";

import { useProjectActions } from "@/hooks/use-project-actions";
import { usePusherSync, useSharedProjects } from "@/hooks/use-shared-projects";
import type { ProjectLists } from "@/types/project";
import dynamic from "next/dynamic";

const ProjectDialogs = dynamic(
	() =>
		import("@/components/editor/project-dialogs").then(
			(mod) => mod.ProjectDialogs,
		),
	{
		ssr: false,
	},
);
const ShareDialog = dynamic(
	() =>
		import("@/components/editor/share-dialog").then((mod) => mod.ShareDialog),
	{
		ssr: false,
	},
);

const AiSidebar = dynamic(
	() => import("@/components/editor/ai-sidebar").then((mod) => mod.AiSidebar),
	{ ssr: false },
);

export const EditorActionContext = createContext<{ onNewProject: () => void }>({
	onNewProject: () => {},
});

/**
 * Carries the shared AI generation status from inside the Liveblocks RoomProvider
 * (CollaborativeCanvas) up to siblings like AiSidebar that live outside it.
 *
 * - `sharedAiStatus` — current status string, or `undefined` when idle.
 * - `onAiStatus`     — called by CollaborativeCanvas whenever the feed fires.
 */
export interface AiStatusContextValue {
	sharedAiStatus: string | undefined;
	onAiStatus: (text: string | undefined) => void;
}

export const AiStatusContext = createContext<AiStatusContextValue>({
	sharedAiStatus: undefined,
	onAiStatus: () => {},
});

/** Convenience hook for consuming the AI status context. */
export function useAiStatus() {
	return useContext(AiStatusContext);
}

export function EditorChrome({
	children,
	ownedProjects,
	sharedProjects,
	userEmail
}: {
	children?: ReactNode;
} & ProjectLists & {userEmail: string}) {
	const params = useParams<{ projectId?: string }>();
	const activeProjectId = params?.projectId ?? null;

	// Keep shared projects fresh — re-fetches on window focus so invitees
	// see newly-shared projects without a manual page reload.
	const { data: liveSharedProjects } = useSharedProjects(sharedProjects);

	usePusherSync(userEmail) // Sits in background listening for live changes

	const projectActions = useProjectActions({
		ownedProjects,
		sharedProjects: liveSharedProjects,
		activeProjectId,
	});
	const [isSidebarOpen, setIsSidebarOpen] = useState(true);
	const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);

	const [isAiSidebarMounted, setIsAiSidebarMounted] = useState(false)
	const [isShareOpen, setIsShareOpen] = useState(false);
	const [isShareDialogMounted, setIsShareDialogMounted] = useState(false);
	/** Latest AI status text from the ai-status-feed. Undefined = no active generation. */
	const [sharedAiStatus, setSharedAiStatus] = useState<string | undefined>();

	const onAiStatus = useCallback((text: string | undefined) => {
		setSharedAiStatus(text);
	}, []);

	const aiStatusValue = useMemo<AiStatusContextValue>(
		() => ({ sharedAiStatus, onAiStatus }),
		[sharedAiStatus, onAiStatus],
	);

	const toggleSidebar = useCallback(() => setIsSidebarOpen((prev) => !prev), []);
	const toggleAiSidebar = useCallback(() => {
		setIsAiSidebarMounted(true);
		setIsAiSidebarOpen((prev) => !prev);
	}, []);
	const handleShare = useCallback(() => {
		setIsShareDialogMounted(true)
		setIsShareOpen(true)
	}, []);
	const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);
	const closeAiSidebar = useCallback(() => setIsAiSidebarOpen(false), []);

	const activeProject = useMemo(() => {
		if (!activeProjectId) return null;
		return [...ownedProjects, ...sharedProjects].find(
			(p) => p.id === activeProjectId,
		);
	}, [activeProjectId, ownedProjects, sharedProjects]);

	const workspaceContent = (
		<>
			<main className="flex-1 justify-center flex overflow-hidden relative">
				{children}
			</main>
			{activeProject && (
				<>
					{isAiSidebarOpen && (
						<div
							className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
							onClick={closeAiSidebar}
						/>
					)}
					{isAiSidebarMounted && (
						<AiSidebar
							isOpen={isAiSidebarOpen}
							onClose={closeAiSidebar}
							projectId={activeProject.id}
						/>
					)}
				</>
			)}
		</>
	);

	return (
		<EditorActionContext.Provider
			value={{ onNewProject: projectActions.openCreate }}
		>
			<AiStatusContext.Provider value={aiStatusValue}>
				<div className="flex flex-col h-screen overflow-hidden bg-base relative">
					<EditorNavbar
						isSidebarOpen={isSidebarOpen}
						toggleSidebar={toggleSidebar}
						projectName={activeProject?.name}
						isAiSidebarOpen={isAiSidebarOpen}
						toggleAiSidebar={toggleAiSidebar}
						onShare={activeProject ? handleShare : undefined}
					/>
					<div className="flex flex-1 overflow-hidden relative">
						<ProjectSidebar
							isOpen={isSidebarOpen}
							onClose={closeSidebar}
							optimisticProjectId={projectActions.mockProjectId}
							ownedProjects={projectActions.ownedProjects}
							sharedProjects={projectActions.sharedProjects}
							activeProjectId={activeProjectId}
							onNewProject={projectActions.openCreate}
							onOpenProject={projectActions.openProject}
							onRename={projectActions.openRename}
							onDelete={projectActions.openDelete}
						/>
						{projectActions.dialogType && (
							<ProjectDialogs {...projectActions} />
						)}
						{isShareDialogMounted && activeProject && (
							<ShareDialog
								open={isShareOpen}
								onOpenChange={setIsShareOpen}
								projectId={activeProject.id}
								projectName={activeProject.name}
								isOwner={activeProject.isOwner}
							/>
						)}
						{activeProject ? (
							<LiveblocksProvider authEndpoint="/api/liveblocks-auth">
								<RoomProvider
									id={activeProject.id}
									initialPresence={{ cursor: null, isThinking: false }}
								>
									{workspaceContent}
								</RoomProvider>
							</LiveblocksProvider>
						) : (
							workspaceContent
						)}
					</div>
				</div>
			</AiStatusContext.Provider>
		</EditorActionContext.Provider>
	);
}

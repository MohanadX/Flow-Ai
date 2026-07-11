"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Project } from "@/types/project";
import OwnedProjects from "./owned-projects";
import SharedProjects from "./shared-projects";

interface ProjectSidebarProps {
	isOpen: boolean;
	onClose: () => void;
	ownedProjects: Project[];
	sharedProjects: Project[];
	ownedCount: number;
	sharedCount: number;
	activeProjectId?: string | null;
	optimisticProjectId: string | null;
	onNewProject: () => void;
	onOpenProject: (project: Project) => void;
	onRename: (project: Project) => void;
	onDelete: (project: Project) => void;
}

export function ProjectSidebar({
	isOpen,
	onClose,
	ownedProjects,
	sharedProjects,
	ownedCount,
	sharedCount,
	activeProjectId,
	optimisticProjectId,
	onNewProject,
	onOpenProject,
	onRename,
	onDelete,
}: ProjectSidebarProps) {
	return (
		<>
			{/* Mobile Backdrop */}
			{isOpen && (
				<div
					className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
					onClick={onClose}
				/>
			)}

			<div
				id="project-sidebar"
				aria-hidden={!isOpen}
				inert={!isOpen ? true : undefined}
				className={cn(
					"fixed top-14 bottom-0 left-0 z-40 w-72 shrink-0 transform border-r border-border bg-card transition-all duration-300 ease-in-out",
					isOpen ? "translate-x-0" : "-translate-x-full pointer-events-none",
				)}
			>
				<div className="flex h-full flex-col">
					{/* Header */}
					<div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
						<h2 className="text-sm font-medium tracking-tight">Projects</h2>
						<Button
							variant="ghost"
							size="icon"
							onClick={onClose}
							className="h-8 w-8"
						>
							<X className="h-4 w-4" />
							<span className="sr-only">Close sidebar</span>
						</Button>
					</div>

					{/* Content */}
					<div className="flex-1 overflow-auto p-4">
						<Tabs defaultValue="my-projects" className="w-full">
							<TabsList className="grid w-full grid-cols-2">
								<TabsTrigger value="my-projects">My Projects</TabsTrigger>
								<TabsTrigger value="shared">Shared</TabsTrigger>
							</TabsList>

							<TabsContent value="my-projects" className="mt-4 space-y-1">
								<OwnedProjects 
									ownedProjects={ownedProjects} 
									ownedCount={ownedCount}
									activeProjectId={activeProjectId} 
									optimisticProjectId={optimisticProjectId} 
									onOpenProject={onOpenProject} 
									onRename={onRename} 
									onDelete={onDelete}
								/>
							</TabsContent>

							<TabsContent value="shared" className="mt-4 space-y-1">
								<SharedProjects
									sharedProjects={sharedProjects} 
									sharedCount={sharedCount}
									activeProjectId={activeProjectId} 
									onOpenProject={onOpenProject}
								/>
							</TabsContent>
						</Tabs>
					</div>

					{/* Footer */}
					<div className="shrink-0 border-t border-border p-4">
						<Button
							className="w-full justify-start"
							variant="default"
							onClick={onNewProject}
						>
							<Plus className="mr-2 h-4 w-4" />
							New Project
						</Button>
					</div>
				</div>
			</div>
		</>
	);
}
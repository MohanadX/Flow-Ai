"use client";

import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Project } from "@/types/project";

interface ProjectSidebarProps {
	isOpen: boolean;
	onClose: () => void;
	ownedProjects: Project[];
	sharedProjects: Project[];
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
								{ownedProjects.length > 0 ? (
									ownedProjects.map((project) => (
										<ProjectItem
											key={project.id}
											project={project}
											isActive={project.id === activeProjectId}
											isOptimistic={project.id === optimisticProjectId}
											onOpen={() => onOpenProject(project)}
											onRename={() => onRename(project)}
											onDelete={() => onDelete(project)}
										/>
									))
								) : (
									<div className="flex flex-col items-center justify-center py-8 text-center">
										<p className="text-sm text-muted-foreground">
											No projects yet.
										</p>
									</div>
								)}
							</TabsContent>

							<TabsContent value="shared" className="mt-4 space-y-1">
								{sharedProjects.length > 0 ? (
									sharedProjects.map((project) => (
										<ProjectItem
											key={project.id}
											project={project}
											isActive={project.id === activeProjectId}
											isOptimistic={project.id === optimisticProjectId}
											onOpen={() => onOpenProject(project)}
										/>
									))
								) : (
									<div className="flex flex-col items-center justify-center py-8 text-center">
										<p className="text-sm text-muted-foreground">
											No shared projects.
										</p>
									</div>
								)}
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

function ProjectItem({
	project,
	isActive,
	isOptimistic,
	onOpen,
	onRename,
	onDelete,
}: {
	project: Project;
	isActive: boolean;
	isOptimistic: boolean;
	onOpen: () => void;
	onRename?: () => void;
	onDelete?: () => void;
}) {
	return (
		<div
			className={cn(
				"group flex items-center justify-between rounded-md text-sm transition-all hover:bg-subtle hover:text-copy-primary",
				isActive
					? "bg-brand/10 text-brand ring-1 ring-brand/30 shadow-[0_0_15px_var(--color-brand-dim)]"
					: "text-copy-secondary",
			)}
		>
			<button
				type="button"
				className="min-w-0 flex-1 truncate px-3 py-2 text-left"
				onClick={onOpen}
			>
				{project.name}
			</button>

			{/* if project is optimistically created it mean it is not yet saved to the database so we shouldn't show the delete and rename buttons */}
			{project.isOwner && (
				isOptimistic ? (
					<div className="flex items-center gap-1 pr-2">
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7"
						>
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						</Button>
					</div>
				) : (
				<div className="flex items-center gap-1 pr-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7"
						onClick={(e) => {
							e.stopPropagation();
							onRename?.();
						}}
					>
						<Pencil className="h-3.5 w-3.5" />
						<span className="sr-only">Rename</span>
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
						onClick={(e) => {
							e.stopPropagation();
							onDelete?.();
						}}
					>
						<Trash2 className="h-3.5 w-3.5" />
						<span className="sr-only">Delete</span>
					</Button>
				</div>
			))}
		</div>
	);
}

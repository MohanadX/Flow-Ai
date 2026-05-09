"use client";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UseProjectActionsReturn } from "@/hooks/use-project-actions";

type ProjectDialogsProps = UseProjectActionsReturn;

const PROJECT_NAME_MAX_LENGTH = 50;

export function ProjectDialogs({
	dialogType,
	activeProject,
	name,
	roomId,
	loading,
	error,
	close,
	handleNameChange,
	submit,
}: ProjectDialogsProps) {
	const handleOpenChange = (open: boolean) => {
		if (!open) close();
	};

	return (
		<>
			<Dialog open={dialogType === "create"} onOpenChange={handleOpenChange}>
				<DialogContent showCloseButton>
					<DialogHeader>
						<DialogTitle>New Project</DialogTitle>
						<DialogDescription>
							Give your project a name to get started.
						</DialogDescription>
					</DialogHeader>

					<div className="flex flex-col gap-2">
						<Input
							placeholder="Project name"
							value={name}
							maxLength={PROJECT_NAME_MAX_LENGTH}
							onChange={(e) => handleNameChange(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && name.trim() && !loading) submit();
							}}
							autoFocus
							className="min-w-0 text-white"
						/>
						<p className="min-h-4 break-all text-xs text-muted-foreground font-mono">
							{roomId ? `Room ID: ${roomId}` : ""}
						</p>
						{error && (
							<p className="text-xs text-destructive font-medium mt-1">
								{error}
							</p>
						)}
					</div>

					<DialogFooter showCloseButton>
						<Button
							onClick={submit}
							disabled={!name.trim() || name.trim().length > 50 || loading}
						>
							{loading ? "Creating…" : "Create Project"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={dialogType === "rename"} onOpenChange={handleOpenChange}>
				<DialogContent showCloseButton>
					<DialogHeader>
						<DialogTitle>Rename Project</DialogTitle>
						<DialogDescription className="wrap-break-word ">
							Renaming &ldquo;{activeProject?.name}&rdquo;
						</DialogDescription>
					</DialogHeader>

					<Input
						placeholder="Project name"
						value={name}
						maxLength={PROJECT_NAME_MAX_LENGTH}
						onChange={(e) => handleNameChange(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && name.trim() && !loading) submit();
						}}
						className="min-w-0 text-white"
						autoFocus
					/>

					{error && (
						<p className="text-xs text-destructive font-medium mt-1">{error}</p>
					)}

					<DialogFooter showCloseButton>
						<Button
							onClick={submit}
							disabled={!name.trim() || name.trim().length > 50 || loading}
						>
							{loading ? "Saving…" : "Save"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={dialogType === "delete"} onOpenChange={handleOpenChange}>
				<DialogContent showCloseButton>
					<DialogHeader>
						<DialogTitle>Delete Project</DialogTitle>
						<DialogDescription className="wrap-break-word">
							Are you sure you want to delete &ldquo;{activeProject?.name}
							&rdquo;? This action cannot be undone.
						</DialogDescription>
					</DialogHeader>

					<DialogFooter showCloseButton>
						<Button variant="destructive" onClick={submit} disabled={loading}>
							{loading ? "Deleting…" : "Delete Project"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}

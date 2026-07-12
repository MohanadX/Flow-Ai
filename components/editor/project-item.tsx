import { cn } from "@/lib/utils";
import { Project } from "@/types/project";
import { Button } from "../ui/button";
import { Loader2, Pencil, Trash2 } from "lucide-react";

export default function ProjectItem({
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
				onClick={isActive ? undefined : onOpen}
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
							disabled
						>
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
							<span className="sr-only">Saving project</span>
						</Button>
					</div>				) : (
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

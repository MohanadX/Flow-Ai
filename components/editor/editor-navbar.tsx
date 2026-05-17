import { PanelLeftClose, PanelLeftOpen, Share2, Sparkles, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EditorNavbarProps {
	isSidebarOpen: boolean;
	toggleSidebar: () => void;
	projectName?: string;
	isAiSidebarOpen?: boolean;
	toggleAiSidebar?: () => void;
	onShare?: () => void;
}

export function EditorNavbar({
	isSidebarOpen,
	toggleSidebar,
	projectName,
	isAiSidebarOpen,
	toggleAiSidebar,
	onShare,
}: EditorNavbarProps) {
	return (
		<header className="relative flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
			<div className="flex items-center">
				<Button
					variant="ghost"
					size="icon"
					onClick={toggleSidebar}
					aria-label="Toggle sidebar"
					aria-expanded={isSidebarOpen}
					aria-controls="project-sidebar"
				>
					{isSidebarOpen ? (
						<PanelLeftClose className="h-5 w-5" />
					) : (
						<PanelLeftOpen className="h-5 w-5" />
					)}
				</Button>
			</div>

			<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex justify-center items-center px-4 pointer-events-none">
				{projectName && (
					<span className="text-sm font-medium text-copy-primary truncate max-w-sm pointer-events-auto">
						{projectName}
					</span>
				)}
			</div>

			<div className="flex items-center justify-end gap-2">
				{projectName && (
					<>
						<Button
							variant="outline"
							size="sm"
							className="hidden sm:flex"
							onClick={() => window.dispatchEvent(new CustomEvent<void>("open-starter-templates"))}
						>
							<LayoutTemplate className="mr-2 h-4 w-4" />
							Templates
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="hidden sm:flex"
							onClick={onShare}
						>
							<Share2 className="mr-2 h-4 w-4" />
							Share
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onClick={toggleAiSidebar}
							className={
								isAiSidebarOpen ? "bg-accent text-accent-foreground" : ""
							}
						>
							<Sparkles className="h-5 w-5" />
							<span className="sr-only">Toggle AI Sidebar</span>
						</Button>
					</>
				)}
			</div>
		</header>
	);
}

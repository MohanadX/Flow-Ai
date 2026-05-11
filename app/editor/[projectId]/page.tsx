import { redirect } from "next/navigation";
import { Compass } from "lucide-react";
import { AccessDenied } from "@/components/editor/access-denied";
import { checkProjectAccess, getCurrentIdentity } from "@/lib/project-access";

interface ProjectWorkspacePageProps {
	params: Promise<{
		projectId: string;
	}>;
}

export default async function ProjectWorkspacePage({
	params,
}: ProjectWorkspacePageProps) {
	const { projectId } = await params;
	const identity = await getCurrentIdentity();

	if (!identity) {
		redirect("/sign-in");
	}

	const accessResult = await checkProjectAccess(projectId, identity);

	if (!accessResult) {
		return <AccessDenied />;
	}

	return (
		<div className="flex-1 flex flex-col items-center justify-center bg-base text-center relative overflow-hidden h-full">
			{/* Radial background behind */}
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-brand/15 via-base to-base pointer-events-none" />
			{/* Light rays overlay */}
			<div className="absolute inset-0 bg-[conic-gradient(from_180deg_at_50%_-10%,var(--color-brand)_0%,transparent_12%,transparent_88%,var(--color-brand)_100%)] opacity-20 pointer-events-none" />

			<div className="z-10 flex flex-col items-center">
				<div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-brand/20 bg-brand/10 shadow-[0_0_30px_var(--color-brand-dim)] mb-6 ring-1 ring-brand/20">
					<Compass className="h-8 w-8 text-brand drop-shadow-md" />
				</div>
				<h2 className="text-2xl font-semibold tracking-tight text-copy-primary mb-2">
					Workspace Shell
				</h2>
				<p className="text-sm text-copy-muted max-w-sm">
					Project room{" "}
					<span className="font-mono text-brand/80">{projectId}</span>.<br />
					Real-time canvas coming soon.
				</p>
			</div>
		</div>
	);
}

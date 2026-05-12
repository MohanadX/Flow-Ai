import { redirect } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { AccessDenied } from "@/components/editor/access-denied";
import { CollaborativeCanvas } from "@/components/editor/collaborative-canvas";
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

	let accessResult: Awaited<ReturnType<typeof checkProjectAccess>>;
	try {
		accessResult = await checkProjectAccess(projectId, identity);
	} catch (error) {
		console.error("Failed to check project access", {
			error,
			projectId,
			userId: identity.userId,
		});
		return <WorkspaceError />;
	}

	if (!accessResult) {
		return <AccessDenied />;
	}

	return <CollaborativeCanvas roomId={projectId} />;
}

function WorkspaceError() {
	return (
		<div className="flex-1 flex flex-col items-center justify-center bg-base text-center h-full px-6">
			<div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-surface-border bg-elevated mb-4">
				<TriangleAlert className="h-5 w-5 text-warning" />
			</div>
			<h2 className="text-lg font-semibold text-copy-primary">
				Workspace unavailable
			</h2>
			<p className="mt-2 max-w-sm text-sm text-copy-muted">
				We could not verify access to this project. Please try again shortly.
			</p>
		</div>
	);
}

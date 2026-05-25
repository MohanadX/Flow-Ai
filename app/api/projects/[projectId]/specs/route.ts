import { ApiError, handleApiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { checkProjectAccess, getCurrentIdentity } from "@/lib/project-access";

interface SpecsRouteContext {
	params: Promise<{ projectId: string }>;
}

export async function GET(
	_request: Request,
	{ params }: SpecsRouteContext,
): Promise<Response> {
	try {
		const { projectId } = await params;
		await requireAccessibleProject(projectId);

		const specs = await prisma.projectSpec.findMany({
			where: { projectId },
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				projectId: true,
				createdAt: true,
			},
		});

		return Response.json({
			specs: specs.map((spec) => ({
				id: spec.id,
				projectId: spec.projectId,
				createdAt: spec.createdAt.toISOString(),
			})),
		});
	} catch (error) {
		return handleApiError(error);
	}
}

async function requireAccessibleProject(projectId: string) {
	const identity = await getCurrentIdentity();

	if (!identity) {
		throw new ApiError(401, "UNAUTHORIZED", "Authentication required.");
	}

	const project = await checkProjectAccess(projectId, identity);

	if (!project) {
		throw new ApiError(404, "NOT_FOUND", "Project not found.");
	}

	return project;
}

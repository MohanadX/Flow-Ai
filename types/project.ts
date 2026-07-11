export interface Project {
	id: string;
	roomId: string;
	name: string;
	slug: string;
	ownerId: string;
	isOwner: boolean;
	description: string | null;
	status: string;
	canvasJsonPath: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface ProjectLists {
	ownedProjects: Project[];
	sharedProjects: Project[];
	ownedCount: number;
	sharedCount: number;
}

export const projectsLimit = 7
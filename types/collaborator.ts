export interface Collaborator {
	email: string;
	name: string | null;
	imageUrl: string | null;
	addedAt: string;
}

export interface Owner {
	userId: string;
	email: string;
	name: string | null;
	imageUrl: string | null;
}

export interface CollaboratorListResponse {
	owner: Owner;
	collaborators: Collaborator[];
	collaboratorCount: number;
}

export const collaboratorsLimit = 7;

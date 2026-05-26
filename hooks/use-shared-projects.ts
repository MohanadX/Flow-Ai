"use client";

import { useQuery } from "@tanstack/react-query";
import type { Project } from "@/types/project";

export const sharedProjectKeys = {
	all: () => ["shared-projects"] as const,
};

async function fetchSharedProjects(): Promise<Project[]> {
	const res = await fetch("/api/projects/shared");
	if (!res.ok) throw new Error("Failed to load shared projects.");
	const data = await res.json();
	return data.projects as Project[];
}

/**
 * Keeps the shared-projects list fresh on the client.
 * Seeds from SSR `initialData` so there's no loading flash on first render.
 * Automatically re-fetches when the user focuses the browser window, which
 * is the primary trigger for the invitee to see a newly-shared project without
 * any manual refresh.
 */
export function useSharedProjects(initialData: Project[]) {
	return useQuery({
		queryKey: sharedProjectKeys.all(),
		queryFn: fetchSharedProjects,
		initialData,
		staleTime: 30_000,
		refetchOnWindowFocus: true,
	});
}

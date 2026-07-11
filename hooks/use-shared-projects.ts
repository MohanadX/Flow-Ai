"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Project } from "@/types/project";
import { useEffect } from "react";
import Pusher from "pusher-js";
import { clientEnv } from "@/env/client";
import { getUserProjectsChannel } from "@/lib/utils";

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
		staleTime: Infinity,
	});
}


export function usePusherSync (userEmail: string) {
	const queryClient = useQueryClient()
	useEffect(() => {
		const pusher = new Pusher(clientEnv.NEXT_PUBLIC_PUSHER_KEY, {
			cluster: clientEnv.NEXT_PUBLIC_PUSHER_CLUSTER,
		})

		// Subscribe to your target channel
		const channel = pusher.subscribe(getUserProjectsChannel(userEmail))

		// bind to a specific event

		channel.bind("project-shared", (data: { project: Project }) => {
			
			queryClient.setQueriesData({ queryKey: sharedProjectKeys.all() }, (old: Project[]) => {
				if (!old) return []; // on initial fetch if event fired
				
				// avoid duplicates (for websocket retries and race condition of share actions)
				if (old.some(p => p.id === data.project.id)) return old;

				return [...old, data.project]
			})
		});

		channel.bind("project-removed", (data: { id: string }) => {
			
			queryClient.setQueriesData({ queryKey: sharedProjectKeys.all() }, (old: Project[]) => {
				if (!old) return [];
				return old.filter(p => p.id !== data.id);
			})
		})

		return () => {
			channel.unbind("project-shared")
			channel.unbind("project-removed")
			channel.unsubscribe()
		}
	}, [queryClient, userEmail])
}
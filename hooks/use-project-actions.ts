"use client";

import {
	useCallback,
	useMemo,
	useState,
	useTransition,
	useOptimistic,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { slugify } from "@/lib/utils";
import type { Project, ProjectLists } from "@/types/project";

export type ProjectDialogType = "create" | "rename" | "delete" | null;

interface UseProjectActionsInput extends ProjectLists {
	activeProjectId?: string | null;
}

interface ProjectResponseBody {
	project: Project;
}

interface ApiErrorResponseBody {
	error?: {
		message?: string;
	};
}

type OptimisticAction =
	| { type: "add"; project: Project }
	| { type: "update"; project: Project }
	| { type: "remove"; projectId: string; isOwner: boolean };

const PROJECT_NAME_MAX_LENGTH = 50;
const PROJECT_ID_MAX_LENGTH = 80;
const ROOM_SUFFIX_LENGTH = 6;

export function useProjectActions({
	ownedProjects,
	sharedProjects,
	activeProjectId,
}: UseProjectActionsInput) {
	const router = useRouter();
	const pathname = usePathname();
	const [dialogType, setDialogType] = useState<ProjectDialogType>(null);
	const [activeProject, setActiveProject] = useState<Project | null>(null);
	const [name, setName] = useState("");
	const [roomSuffix, setRoomSuffix] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [, startTransition] = useTransition();

	const [optimisticOwned, dispatchOptimisticOwned] = useOptimistic<
		Project[],
		OptimisticAction
	>(ownedProjects, (state, action) => {
		if (action.type === "add")
			return action.project.isOwner ? [action.project, ...state] : state;
		if (action.type === "update")
			return state.map((p) =>
				p.id === action.project.id ? action.project : p,
			);
		if (action.type === "remove")
			return action.isOwner
				? state.filter((p) => p.id !== action.projectId)
				: state;
		return state;
	});

	const [optimisticShared, dispatchOptimisticShared] = useOptimistic<
		Project[],
		OptimisticAction
	>(sharedProjects, (state, action) => {
		if (action.type === "add")
			return !action.project.isOwner ? [action.project, ...state] : state;
		if (action.type === "update")
			return state.map((p) =>
				p.id === action.project.id ? action.project : p,
			);
		if (action.type === "remove")
			return !action.isOwner
				? state.filter((p) => p.id !== action.projectId)
				: state;
		return state;
	});

	const projects = useMemo(
		() => [...optimisticOwned, ...optimisticShared],
		[optimisticOwned, optimisticShared],
	);

	const roomId = useMemo(() => {
		if (dialogType !== "create" || !roomSuffix) {
			return "";
		}

		return createRoomId(name, roomSuffix);
	}, [dialogType, name, roomSuffix]);

	const close = useCallback(() => {
		setDialogType(null);
		setActiveProject(null);
		setName("");
		setRoomSuffix("");
		setError(null);
	}, []);

	const openCreate = useCallback(() => {
		setName("");
		setRoomSuffix(generateShortSuffix());
		setError(null);
		setActiveProject(null);
		setDialogType("create");
	}, []);

	const openRename = useCallback((project: Project) => {
		setName(project.name);
		setRoomSuffix("");
		setError(null);
		setActiveProject(project);
		setDialogType("rename");
	}, []);

	const openDelete = useCallback((project: Project) => {
		setName("");
		setRoomSuffix("");
		setError(null);
		setActiveProject(project);
		setDialogType("delete");
	}, []);

	const openProject = useCallback(
		(project: Project) => {
			router.push(`/editor/${project.id}`);
		},
		[router],
	);

	const handleNameChange = useCallback(
		(value: string) => {
			setName(value);
			if (error) {
				setError(null);
			}
		},
		[error],
	);

	const submit = useCallback(async () => {
		if (loading || !dialogType) {
			return;
		}

		setError(null);

		try {
			setLoading(true);

			if (dialogType === "create") {
				const trimmedName = validateProjectName(name);
				const nextRoomId = createRoomId(trimmedName, roomSuffix);

				const response = await fetch("/api/projects", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ id: nextRoomId, name: trimmedName }),
				});

				const body = await parseProjectResponse(response);

				startTransition(() => {
					dispatchOptimisticOwned({ type: "add", project: body.project });
					dispatchOptimisticShared({ type: "add", project: body.project });
					router.push(`/editor/${body.project.id}`);
					router.refresh();
				});
				close();
				return;
			}

			if (dialogType === "rename" && activeProject) {
				const trimmedName = validateProjectName(name);
				const response = await fetch(`/api/projects/${activeProject.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ name: trimmedName }),
				});

				const body = await parseProjectResponse(response);

				startTransition(() => {
					dispatchOptimisticOwned({ type: "update", project: body.project });
					dispatchOptimisticShared({ type: "update", project: body.project });
					router.refresh();
				});
				close();
				return;
			}

			if (dialogType === "delete" && activeProject) {
				const response = await fetch(`/api/projects/${activeProject.id}`, {
					method: "DELETE",
				});

				await parseProjectResponse(response);
				const isDeletingActiveProject =
					activeProject.id === activeProjectId ||
					pathname === `/editor/${activeProject.id}`;

				startTransition(() => {
					dispatchOptimisticOwned({
						type: "remove",
						projectId: activeProject.id,
						isOwner: activeProject.isOwner,
					});
					dispatchOptimisticShared({
						type: "remove",
						projectId: activeProject.id,
						isOwner: activeProject.isOwner,
					});
					if (isDeletingActiveProject) {
						router.replace("/editor");
						router.refresh();
					} else {
						router.refresh();
					}
				});
				close();
			}
		} catch (submitError) {
			setError(
				submitError instanceof Error
					? submitError.message
					: "Something went wrong.",
			);
		} finally {
			setLoading(false);
		}
	}, [
		activeProject,
		activeProjectId,
		close,
		dialogType,
		loading,
		name,
		pathname,
		roomSuffix,
		router,
		startTransition,
		dispatchOptimisticOwned,
		dispatchOptimisticShared,
	]);

	return {
		projects,
		ownedProjects: optimisticOwned,
		sharedProjects: optimisticShared,
		dialogType,
		activeProject,
		name,
		roomId,
		loading,
		error,
		openCreate,
		openRename,
		openDelete,
		openProject,
		close,
		handleNameChange,
		submit,
	};
}

export type UseProjectActionsReturn = ReturnType<typeof useProjectActions>;

function validateProjectName(name: string): string {
	const trimmedName = name.trim();

	if (!trimmedName) {
		throw new Error("Name is required.");
	}

	if (trimmedName.length > PROJECT_NAME_MAX_LENGTH) {
		throw new Error(
			`Name must be ${PROJECT_NAME_MAX_LENGTH} characters or less.`,
		);
	}

	return trimmedName;
}

function createRoomId(name: string, suffix: string): string {
	const baseSlug = slugify(name) || "project";
	const maxBaseLength = PROJECT_ID_MAX_LENGTH - suffix.length - 1;
	const base = baseSlug.slice(0, maxBaseLength).replace(/-+$/g, "");

	return `${base || "project"}-${suffix}`;
}

function generateShortSuffix(): string {
	const bytes = new Uint8Array(ROOM_SUFFIX_LENGTH);

	if (globalThis.crypto) {
		globalThis.crypto.getRandomValues(bytes);
		return Array.from(bytes, (byte) => (byte % 36).toString(36)).join("");
	}

	return Math.random()
		.toString(36)
		.slice(2, 2 + ROOM_SUFFIX_LENGTH)
		.padEnd(ROOM_SUFFIX_LENGTH, "0");
}

async function parseProjectResponse(
	response: Response,
): Promise<ProjectResponseBody> {
	const body: unknown = await response.json().catch(() => null);

	if (!response.ok) {
		throw new Error(readErrorMessage(body));
	}

	if (
		typeof body === "object" &&
		body !== null &&
		"project" in body &&
		typeof body.project === "object" &&
		body.project !== null
	) {
		return body as ProjectResponseBody;
	}

	throw new Error("Unexpected project API response.");
}

function readErrorMessage(body: unknown): string {
	const message =
		typeof body === "object" && body !== null && "error" in body
			? (body as ApiErrorResponseBody).error?.message
			: undefined;

	if (typeof message === "string") {
		return message;
	}

	return "Project request failed.";
}

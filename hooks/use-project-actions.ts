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
	| { type: "remove"; projectId: string; };

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
	const [mockProjectId, setMockProjectId] = useState<string | null>(null)
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
			return [action.project, ...state];
		if (action.type === "update")
			return state.map((p) =>
				p.id === action.project.id ? action.project : p,
			);
		if (action.type === "remove")
			return state.filter((p) => p.id !== action.projectId);
		return state;
	});

	const projects = useMemo(
		() => [...optimisticOwned, ...sharedProjects],
		[optimisticOwned, sharedProjects],
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
    setLoading(true);

    // Keep track of what we did so we know exactly what to roll back if things break
    let appliedOptimisticType: "create" | "rename" | "delete" | null = null;
    let fallbackProjectContext: Project | null = null;
    let fallbackCreatedId = "";

    try {
        //  pre-compute data
        const trimmedName = dialogType !== "delete" ? validateProjectName(name) : "";
        const targetProjectId = activeProject?.id;
        
        // Create a temporary mock project for the "create" action
        const mockProjectId = dialogType === "create" ? createRoomId(trimmedName, roomSuffix) : "";

        const mockProject: Project = {
            id: mockProjectId,
            roomId: mockProjectId,
            name: trimmedName,
            slug: slugify(trimmedName) || "project",
            ownerId: activeProject?.ownerId ?? "",
            isOwner: true,
            description: activeProject?.description ?? null,
            status: activeProject?.status ?? "active",
            canvasJsonPath: activeProject?.canvasJsonPath ?? null,
            createdAt: activeProject?.createdAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        //  dispatch optimistic updates first
        startTransition(() => {
            if (dialogType === "create") {
                appliedOptimisticType = "create";
                fallbackCreatedId = mockProjectId;

                dispatchOptimisticOwned({ type: "add", project: mockProject });
                router.push(`/editor/${mockProjectId}`);
            } 
            else if (dialogType === "rename" && activeProject) {
                appliedOptimisticType = "rename";
                fallbackProjectContext = { ...activeProject }; 
                
                dispatchOptimisticOwned({ type: "update", project: { ...activeProject, name: trimmedName } });
            } 
            else if (dialogType === "delete" && activeProject) {
                appliedOptimisticType = "delete";
                fallbackProjectContext = { ...activeProject };

                dispatchOptimisticOwned({ type: "remove", projectId: targetProjectId! });
                
                const isDeletingActiveProject =
                    targetProjectId === activeProjectId || pathname === `/editor/${targetProjectId}`;
                if (isDeletingActiveProject) {
                    router.replace("/editor");
                }
            }
            // Close the modal immediately for snappier UX
            close(); 
        });

		setMockProjectId((fallbackProjectContext as unknown as Project)?.id || fallbackCreatedId) // for tracking this project while loading state in project sidebar

        //  fire the network request in the background
        let response: Response;
        if (dialogType === "create") {
            response = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: mockProjectId, name: trimmedName }),
            });
        } else if (dialogType === "rename" && targetProjectId) {
            response = await fetch(`/api/projects/${targetProjectId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: trimmedName }),
            });
        } else if (dialogType === "delete" && targetProjectId) {
            response = await fetch(`/api/projects/${targetProjectId}`, {
                method: "DELETE",
            });
        } else {
            throw new Error("Invalid active project context for mutation.");
        }

        //  verify response 
        const body = await parseProjectResponse(response);

        // Replace the placeholder UI entry with the absolute truth from the server database
        if (dialogType === "create" || dialogType === "rename") {
            startTransition(() => {
                dispatchOptimisticOwned({ type: "update", project: body.project });
                router.refresh();
            });
        } else {
            startTransition(() => {
                router.refresh();
            });
        }

    } catch (submitError) {
        // Catch block: rollback all changes 
        setError(
            submitError instanceof Error ? submitError.message : "Something went wrong."
        );

        // Revert UI to original state based on the tracked failure context
        startTransition(() => {
            if (appliedOptimisticType === "create" && fallbackCreatedId) {
                dispatchOptimisticOwned({ type: "remove", projectId: fallbackCreatedId });
                router.replace("/editor"); 
            } 
            else if (appliedOptimisticType === "rename" && fallbackProjectContext) {
                dispatchOptimisticOwned({ type: "update", project: fallbackProjectContext });
            } 
            else if (appliedOptimisticType === "delete" && fallbackProjectContext) {
                dispatchOptimisticOwned({ type: "add", project: fallbackProjectContext });
                
                if (fallbackProjectContext.id === activeProjectId) {
                    router.replace(`/editor/${fallbackProjectContext.id}`);
                }
            }
            router.refresh();
        });

    } finally {
        setLoading(false);
		setMockProjectId(null)
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
]);

	return {
		projects,
		ownedProjects: optimisticOwned,
		sharedProjects,
		dialogType,
		activeProject,
		mockProjectId,
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

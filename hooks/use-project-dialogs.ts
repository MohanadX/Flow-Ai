"use client";

import { useState } from "react";
import { slugify } from "@/lib/utils";

import { Project } from "@/types/project";

export type DialogType = "create" | "rename" | "delete" | null;

export interface DialogProps {
	projectDialogs: {
		dialogType: DialogType;
		close: () => void;
		name: string;
		handleNameChange: (value: string) => void;
		slug: string;
		loading: boolean;
		error: string | null;
		submit: () => void;
	};
}


const MOCK_PROJECTS: Project[] = [
	{ id: "1", name: "Ghost AI Core", slug: "ghost-ai-core", isOwner: true, ownerId: "user_1" },
	{ id: "2", name: "Design System", slug: "design-system", isOwner: true, ownerId: "user_1" },
	{
		id: "3",
		name: "Partner Integration",
		slug: "partner-integration",
		isOwner: false,
		ownerId: "user_2",
	},
];

export function useProjectDialogs() {
	const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
	const [dialogType, setDialogType] = useState<DialogType>(null);
	const [activeProject, setActiveProject] = useState<Project | null>(null);
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const openCreate = () => {
		setName("");
		setSlug("");
		setError(null);
		setActiveProject(null);
		setDialogType("create");
	};

	const openRename = (project: Project) => {
		setName(project.name);
		setSlug(project.slug);
		setError(null);
		setActiveProject(project);
		setDialogType("rename");
	};

	const openDelete = (project: Project) => {
		setError(null);
		setActiveProject(project);
		setDialogType("delete");
	};

	const close = () => {
		setDialogType(null);
		setActiveProject(null);
		setName("");
		setSlug("");
		setError(null);
	};

	const handleNameChange = (value: string) => {
		setName(value);
		setSlug(slugify(value));
		if (error) setError(null);
	};

	const submit = async () => {
		if (loading) return;

		const trimmedName = name.trim();

		// Validation
		if (dialogType === "create" || dialogType === "rename") {
			if (!trimmedName) {
				setError("Name is required");
				return;
			}
			if (trimmedName.length > 50) {
				setError("Name must be 50 characters or less");
				return;
			}
			if (!/^[a-zA-Z0-9\s-]+$/.test(trimmedName)) {
				setError("Only letters, numbers, spaces, and hyphens allowed");
				return;
			}
		}

		setLoading(true);
		await new Promise((r) => setTimeout(r, 400));

		if (dialogType === "create") {
			const finalSlug = slug || slugify(trimmedName);
			if (!finalSlug) {
				setError("Invalid name for URL");
				setLoading(false);
				return;
			}
			const newProject: Project = {
				id: String(Date.now()),
				name: trimmedName,
				slug: finalSlug,
				isOwner: true,
				ownerId: "current_user",
			};
			setProjects((prev) => [...prev, newProject]);
		} else if (dialogType === "rename" && activeProject) {
			const finalSlug = slug || slugify(trimmedName);
			if (!finalSlug) {
				setError("Invalid name for URL");
				setLoading(false);
				return;
			}
			setProjects((prev) =>
				prev.map((p) =>
					p.id === activeProject.id
						? { ...p, name: trimmedName, slug: finalSlug }
						: p,
				),
			);
		} else if (dialogType === "delete" && activeProject) {
			setProjects((prev) => prev.filter((p) => p.id !== activeProject.id));
		}

		setLoading(false);
		close();
	};

	return {
		projects,
		dialogType,
		activeProject,
		name,
		slug,
		loading,
		error,
		openCreate,
		openRename,
		openDelete,
		close,
		handleNameChange,
		submit,
	};
}

"use client";

import { useState } from "react";
import { slugify } from "@/lib/utils";

export interface Project {
	id: string;
	name: string;
	slug: string;
	owned: boolean;
}

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
	{ id: "1", name: "Ghost AI Core", slug: "ghost-ai-core", owned: true },
	{ id: "2", name: "Design System", slug: "design-system", owned: true },
	{
		id: "3",
		name: "Partner Integration",
		slug: "partner-integration",
		owned: false,
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
		setLoading(true);
		await new Promise((r) => setTimeout(r, 400));

		if (dialogType === "create" && name.trim()) {
			if (name.trim().length > 50) {
				setError("Name must be 50 characters or less");
				setLoading(false);
				return;
			}
			const finalSlug = slug || slugify(name.trim());
			if (!finalSlug) {
				setError("Invalid name for URL");
				setLoading(false);
				return;
			}
			const newProject: Project = {
				id: String(Date.now()),
				name: name.trim(),
				slug: finalSlug,
				owned: true,
			};
			setProjects((prev) => [...prev, newProject]);
		} else if (dialogType === "rename" && activeProject && name.trim()) {
			if (name.trim().length > 50) {
				setError("Name must be 50 characters or less");
				setLoading(false);
				return;
			}
			const finalSlug = slug || slugify(name.trim());
			if (!finalSlug) {
				setError("Invalid name for URL");
				setLoading(false);
				return;
			}
			setProjects((prev) =>
				prev.map((p) =>
					p.id === activeProject.id
						? { ...p, name: name.trim(), slug: finalSlug }
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

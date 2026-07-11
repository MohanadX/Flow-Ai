import { Project, projectsLimit } from "@/types/project"
import ProjectItem from "./project-item"
import dynamic from "next/dynamic"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { useState } from "react"
import { Loader2 } from "lucide-react"

const Pagination = dynamic(() => import("./Pagination"))

interface ownedProjectProps {
    ownedProjects : Project[]
    ownedCount: number;
    activeProjectId?: string | null;
    optimisticProjectId: string | null;
    onOpenProject: (project: Project) => void;
    onRename: (project: Project) => void;
    onDelete: (project: Project) => void;
}


export default function OwnedProjects ({ownedProjects, ownedCount, activeProjectId, optimisticProjectId, onOpenProject, onRename, onDelete}: ownedProjectProps) {
    const [page, setPage] = useState(1);

    const { data: projects, isFetching } = useQuery({
    queryKey: ["owned-projects", page],
    queryFn: async () => {
        const res = await fetch(`/api/projects?page=${page}`);
        if (!res.ok) throw new Error("Failed to fetch owned projects");
        const json = await res.json();
        return json.projects as Project[];
    },
    placeholderData: keepPreviousData,
    initialData: page === 1 ? ownedProjects : undefined,
    });

    const totalPages = Math.ceil((ownedCount || 1) / projectsLimit);

  // If we are on page 1, use the prop (which has optimistic updates), otherwise use query data
    const displayProjects = page === 1 ? ownedProjects : (projects || []);

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 space-y-1">
                {displayProjects.length > 0 ? (
                    displayProjects.map((project) => (
                        <ProjectItem
                            key={project.id}
                            project={project}
                            isActive={project.id === activeProjectId}
                            isOptimistic={project.id === optimisticProjectId}
                            onOpen={() => onOpenProject(project)}
                            onRename={() => onRename(project)}
                            onDelete={() => onDelete(project)}
                        />
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <p className="text-sm text-muted-foreground">
                            No projects yet.
                        </p>
                    </div>
                )}
            </div>
            {totalPages > 1 && (
                <div className="mt-4 flex justify-center border-t pt-2 relative">
                    <Pagination currentPage={page} setPage={setPage} totalPages={totalPages} />
                    {isFetching && <Loader2 className="w-4 h-4 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />}
                </div>
            )}
        </div>
    )
}

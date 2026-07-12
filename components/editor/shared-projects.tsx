import { Project, projectsLimit } from "@/types/project";
import ProjectItem from "./project-item";
import dynamic from "next/dynamic";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { apiClient, getApiClientErrorMessage } from "@/lib/api-client";

const Pagination = dynamic(() => import("./Pagination"));

interface sharedProjectProps {
    sharedProjects : Project[]
    sharedCount: number;
    activeProjectId?: string | null;
    onOpenProject: (project: Project) => void;
}

export default function SharedProjects({sharedProjects, sharedCount, activeProjectId, onOpenProject}: sharedProjectProps) {
    const [page, setPage] = useState(1);

    const { data: projects, isFetching } = useQuery({
        queryKey: ["shared-projects-paginated", page],
        queryFn: async () => {
            try {
                const { data } = await apiClient.get<{ projects: Project[] }>("/api/projects/shared", {
                    params: { page },
                });
                return data.projects;
            } catch (error) {
                throw new Error(
                    getApiClientErrorMessage(error) ?? "Failed to fetch shared projects",
                );
            }
        },
        placeholderData: keepPreviousData,
        initialData: page === 1 ? sharedProjects : undefined,
    });

    const totalPages = Math.ceil((sharedCount || 1) / projectsLimit);
    const displayProjects = page === 1 ? sharedProjects : (projects || []);

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 space-y-1">
                {displayProjects.length > 0 ? (
                    displayProjects.map((project) => (
                        <ProjectItem
                            key={project.id}
                            project={project}
                            isActive={project.id === activeProjectId}
                            isOptimistic={false}
                            onOpen={() => onOpenProject(project)}
                        />
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <p className="text-sm text-muted-foreground">
                            No shared projects.
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

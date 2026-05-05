"use client";

import { ReactNode, useState } from "react";
import { EditorNavbar } from "@/components/editor/editor-navbar";
import { ProjectSidebar } from "@/components/editor/project-sidebar";
import { ProjectDialogs } from "@/components/editor/project-dialogs";
import { useProjectDialogs } from "@/hooks/use-project-dialogs";

export function EditorChrome({
  children,
  projectDialogs,
}: {
  children: ReactNode;
  projectDialogs: ReturnType<typeof useProjectDialogs>;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-base relative">
      <EditorNavbar
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />
      <ProjectSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        projects={projectDialogs.projects}
        onNewProject={projectDialogs.openCreate}
        onRename={projectDialogs.openRename}
        onDelete={projectDialogs.openDelete}
      />
      <ProjectDialogs {...projectDialogs} />
      <main className="flex-1 overflow-hidden relative">{children}</main>
    </div>
  );
}

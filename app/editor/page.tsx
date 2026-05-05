"use client";

import { Plus } from "lucide-react";
import { EditorChrome } from "@/components/editor/editor-chrome";
import { Button } from "@/components/ui/button";
import { useProjectDialogs } from "@/hooks/use-project-dialogs";

export default function EditorPage() {
  const projectDialogs = useProjectDialogs();

  return (
    <EditorChrome projectDialogs={projectDialogs}>
      <div className="flex h-full flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-copy-primary">
          Create a project or open an existing one
        </h1>
        <p className="mt-2 max-w-md text-copy-muted">
          Start a new architecture workspace, or choose a project from the sidebar.
        </p>
        <Button 
          onClick={projectDialogs.openCreate}
          className="mt-8"
          size="lg"
        >
          <Plus className="mr-2 h-5 w-5" />
          New Project
        </Button>
      </div>
    </EditorChrome>
  );
}

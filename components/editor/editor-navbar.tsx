import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserButton } from "@clerk/nextjs";

interface EditorNavbarProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}

export function EditorNavbar({
  isSidebarOpen,
  toggleSidebar,
}: EditorNavbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          aria-expanded={isSidebarOpen}
          aria-controls="project-sidebar"
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="h-5 w-5" />
          ) : (
            <PanelLeftOpen className="h-5 w-5" />
          )}
        </Button>
      </div>

      <div className="flex-1 flex justify-center">
        {/* Center section - for future use */}
      </div>

      <div className="flex items-center justify-end w-12">
        <UserButton />
      </div>
    </header>
  );
}

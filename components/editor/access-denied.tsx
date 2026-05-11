import { Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function AccessDenied() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-base">
      <div className="rounded-full bg-brand/10 p-3 mb-4">
        <Lock className="h-8 w-8 text-brand" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-copy-primary mb-2">
        Access Denied
      </h1>
      <p className="text-copy-muted max-w-sm mb-6">
        You do not have permission to view this project or it does not exist.
      </p>
      <Button asChild>
        <Link href="/editor">Return to Editor</Link>
      </Button>
    </div>
  );
}

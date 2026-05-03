import { EditorChrome } from "@/components/editor/editor-chrome";

export default function EditorPage() {
	return (
		<EditorChrome>
			<div className="flex h-full items-center justify-center">
				<p className="text-copy-muted">
					Select or create a project to get started.
				</p>
			</div>
		</EditorChrome>
	);
}

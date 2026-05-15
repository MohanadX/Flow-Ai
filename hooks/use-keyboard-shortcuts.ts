"use client";

import { type RefObject, useEffect } from "react";
import type { Edge, Node, ReactFlowInstance } from "@xyflow/react";

interface UseKeyboardShortcutsOptions<
	NodeType extends Node = Node,
	EdgeType extends Edge = Edge,
> {
	reactFlowInstanceRef: RefObject<ReactFlowInstance<NodeType, EdgeType> | null>;
	onUndo: () => void;
	onRedo: () => void;
}

/**
 * Attaches canvas keyboard shortcuts to the window.
 * Ignores events that originate from editable elements (inputs, textareas,
 * contenteditable regions) so that normal typing is never interrupted.
 */
export function useKeyboardShortcuts<
	NodeType extends Node = Node,
	EdgeType extends Edge = Edge,
>({
	reactFlowInstanceRef,
	onUndo,
	onRedo,
}: UseKeyboardShortcutsOptions<NodeType, EdgeType>) {
	useEffect(() => {
		function isEditableTarget(event: KeyboardEvent): boolean {
			const target = event.target as HTMLElement | null;
			if (!target) return false;

			const tag = target.tagName.toLowerCase();
			if (tag === "input" || tag === "textarea") return true;
			if (target.isContentEditable) return true;

			return false;
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (isEditableTarget(event)) return;

			const isMeta = event.ctrlKey || event.metaKey;
			const instance = reactFlowInstanceRef.current;

			// Zoom in: + or =
			if (!isMeta && (event.key === "+" || event.key === "=")) {
				event.preventDefault();
				instance?.zoomIn({ duration: 200 });
				return;
			}

			// Zoom out: -
			if (!isMeta && event.key === "-") {
				event.preventDefault();
				instance?.zoomOut({ duration: 200 });
				return;
			}

			const isZ = event.key.toLowerCase() === "z" || event.code === "KeyZ";
			const isY = event.key.toLowerCase() === "y" || event.code === "KeyY";

			// Undo: Ctrl/Cmd + Z
			if (isMeta && !event.shiftKey && isZ) {
				event.preventDefault();
				onUndo();
				return;
			}

			// Redo: Ctrl/Cmd + Shift + Z  or  Ctrl/Cmd + Y
			if ((isMeta && event.shiftKey && isZ) || (isMeta && isY)) {
				event.preventDefault();
				onRedo();
				return;
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [reactFlowInstanceRef, onUndo, onRedo]);
}

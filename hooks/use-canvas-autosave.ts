"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { apiClient, getApiClientErrorMessage } from "@/lib/api-client";
import type {
	CanvasEdge,
	CanvasNode,
	CanvasSaveStatus,
	CanvasSnapshot,
} from "@/types/canvas";

interface UseCanvasAutosaveOptions {
	projectId: string;
	nodes: CanvasNode[];
	edges: CanvasEdge[];
	enabled: boolean;
	debounceMs?: number;
}

interface UseCanvasAutosaveResult {
	status: CanvasSaveStatus;
	errorMessage: string | null;
	lastSavedAt: string | null;
}

const DEFAULT_AUTOSAVE_DEBOUNCE_MS = 2000;

export function useCanvasAutosave({
	projectId,
	nodes,
	edges,
	enabled,
	debounceMs = DEFAULT_AUTOSAVE_DEBOUNCE_MS,
}: UseCanvasAutosaveOptions): UseCanvasAutosaveResult {
	const [status, setStatus] = useState<CanvasSaveStatus>("idle");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
	const lastPayloadRef = useRef<string | null>(null);

	// Defer the heavy props so they "lag" behind active drags (like transition but with values)
	const deferredNodes = useDeferredValue(nodes);
	const deferredEdges = useDeferredValue(edges);
	useEffect(() => {
		if (!enabled) return;

		const payload = JSON.stringify({ deferredNodes, deferredEdges });

		if (payload === lastPayloadRef.current) return;

		let isCurrentSave = true;
		const timeoutId = window.setTimeout(() => {
			async function saveCanvas() {
				setStatus("saving");
				setErrorMessage(null);

				try {
					const { data } = await apiClient.put<unknown>(
						`/api/projects/${projectId}/canvas`,
						{ nodes: deferredNodes, edges: deferredEdges },
					);

					if (!isCurrentSave) return;

					const savedAt = getSavedAt(data);
					lastPayloadRef.current = payload;
					setLastSavedAt(savedAt);
					setStatus("saved");
				} catch (error) {
					if (!isCurrentSave) return;

					setStatus("error");
					setErrorMessage(
						getApiClientErrorMessage(error, {
							timeoutMessage: "Canvas autosave timed out.",
						}) ?? "Canvas autosave failed.",
					);
				}
			}

			void saveCanvas();
		}, debounceMs);

		return () => {
			isCurrentSave = false;
			window.clearTimeout(timeoutId);
		};
	}, [debounceMs, deferredEdges, enabled, deferredNodes, projectId]);

	return { status, errorMessage, lastSavedAt };
}

function getSavedAt(value: unknown): string {
	if (!isRecord(value) || !isRecord(value.canvas)) {
		return new Date().toISOString();
	}

	const canvas = value.canvas as Partial<CanvasSnapshot>;

	return typeof canvas.savedAt === "string"
		? canvas.savedAt
		: new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

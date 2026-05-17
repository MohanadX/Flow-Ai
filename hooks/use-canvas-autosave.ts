"use client";

import { useEffect, useRef, useState } from "react";
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

const DEFAULT_AUTOSAVE_DEBOUNCE_MS = 1200;

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

	useEffect(() => {
		if (!enabled) return;

		const payload = JSON.stringify({ nodes, edges });

		if (payload === lastPayloadRef.current) return;

		let controller: AbortController | null = null;
		const timeoutId = window.setTimeout(() => {
			controller = new AbortController();

			async function saveCanvas() {
				setStatus("saving");
				setErrorMessage(null);

				try {
					const response = await fetch(`/api/projects/${projectId}/canvas`, {
						method: "PUT",
						headers: {
							"Content-Type": "application/json",
						},
						body: payload,
						signal: controller?.signal,
					});

					if (!response.ok) {
						const body = await response.json().catch(() => null);
						const message = getErrorMessage(body);
						throw new Error(message ?? "Canvas autosave failed.");
					}

					const body: unknown = await response.json();
					const savedAt = getSavedAt(body);
					lastPayloadRef.current = payload;
					setLastSavedAt(savedAt);
					setStatus("saved");
				} catch (error) {
					if (controller?.signal.aborted) return;

					setStatus("error");
					setErrorMessage(
						error instanceof Error ? error.message : "Canvas autosave failed.",
					);
				}
			}

			void saveCanvas();
		}, debounceMs);

		return () => {
			window.clearTimeout(timeoutId);
			controller?.abort();
		};
	}, [debounceMs, edges, enabled, nodes, projectId]);

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

function getErrorMessage(value: unknown): string | null {
	if (!isRecord(value) || !isRecord(value.error)) return null;

	return typeof value.error.message === "string" ? value.error.message : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

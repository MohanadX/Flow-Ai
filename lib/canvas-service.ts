import "server-only";

import { get, put } from "@vercel/blob";
import { ApiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import type { CanvasEdge, CanvasNode, CanvasSnapshot } from "@/types/canvas";

const CANVAS_SNAPSHOT_VERSION = 1;

interface PersistCanvasResult {
	canvas: CanvasSnapshot;
	canvasJsonPath: string;
}

export function parseCanvasSnapshotInput(
	body: Record<string, unknown>,
): CanvasSnapshot {
	const nodes = parseCanvasItems<CanvasNode>(body.nodes, "nodes");
	const edges = parseCanvasItems<CanvasEdge>(body.edges, "edges");

	return {
		nodes,
		edges,
		version: CANVAS_SNAPSHOT_VERSION,
		savedAt: new Date().toISOString(),
	};
}

export async function saveCanvasSnapshot(
	projectId: string,
	canvas: CanvasSnapshot,
): Promise<PersistCanvasResult> {
	const blob = await put(
		`canvas/${projectId}.json`,
		JSON.stringify(canvas),
		{
			access: "private",
			allowOverwrite: true,
			cacheControlMaxAge: 60,
			contentType: "application/json",
		},
	);

	await prisma.project.update({
		where: { id: projectId },
		data: { canvasJsonPath: blob.url },
	});

	return {
		canvas,
		canvasJsonPath: blob.url,
	};
}

export async function loadCanvasSnapshot(
	canvasJsonPath: string | null,
): Promise<CanvasSnapshot | null> {
	if (!canvasJsonPath) return null;

	const blob = await get(canvasJsonPath, {
		access: "private",
		useCache: false,
	});

	if (!blob || blob.statusCode !== 200 || !blob.stream) {
		throw new ApiError(
			502,
			"CANVAS_BLOB_READ_FAILED",
			"Saved canvas could not be loaded.",
		);
	}

	const parsed: unknown = await new Response(blob.stream).json();
	return parseStoredCanvasSnapshot(parsed);
}

function parseStoredCanvasSnapshot(value: unknown): CanvasSnapshot {
	if (!isRecord(value)) {
		throw new ApiError(
			502,
			"INVALID_CANVAS_BLOB",
			"Saved canvas data is invalid.",
		);
	}

	const nodes = parseCanvasItems<CanvasNode>(value.nodes, "nodes");
	const edges = parseCanvasItems<CanvasEdge>(value.edges, "edges");
	const savedAt =
		typeof value.savedAt === "string"
			? value.savedAt
			: new Date().toISOString();

	return {
		nodes,
		edges,
		version: CANVAS_SNAPSHOT_VERSION,
		savedAt,
	};
}

function parseCanvasItems<T extends { id: string }>(
	value: unknown,
	fieldName: "nodes" | "edges",
): T[] {
	if (!Array.isArray(value)) {
		throw new ApiError(
			400,
			"BAD_REQUEST",
			`Canvas ${fieldName} must be an array.`,
		);
	}

	for (const item of value) {
		if (!isRecord(item) || typeof item.id !== "string") {
			throw new ApiError(
				400,
				"BAD_REQUEST",
				`Canvas ${fieldName} must contain objects with string IDs.`,
			);
		}
	}

	return value as T[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

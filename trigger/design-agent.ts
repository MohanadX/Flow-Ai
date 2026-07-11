import { metadata, queue, retry, task } from "@trigger.dev/sdk";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { Liveblocks } from "@liveblocks/node";
import { mutateFlow } from "@liveblocks/react-flow/node";
import { z } from "zod";

import { serverEnv } from "@/env/server";
import {
	CANVAS_EDGE_TYPE,
	CANVAS_NODE_TYPE,
	NODE_COLORS,
	NODE_SHAPES,
	SHAPE_DEFAULT_SIZES,
	type CanvasEdge,
	type CanvasNode,
	type NodeShape,
} from "@/types/canvas";

export interface DesignAgentPayload {
	prompt: string;
	roomId: string;
}

interface GeneratedArchitecture {
	addedNodes: SanitizedAddedNode[];
	updatedNodes: SanitizedUpdatedNode[];
	deletedNodeIds: string[];
	addedEdges: SanitizedAddedEdge[];
	updatedEdges: SanitizedUpdatedEdge[];
	deletedEdgeIds: string[];
}

interface SanitizedAddedNode {
	id: string;
	label: string;
	shape: NodeShape;
	color: string;
	textColor: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

interface SanitizedUpdatedNode {
	id: string;
	label?: string;
	shape?: NodeShape;
	color?: string;
	textColor?: string;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
}

interface SanitizedAddedEdge {
	id: string;
	source: string;
	target: string;
	label?: string;
}

interface SanitizedUpdatedEdge {
	id: string;
	label?: string;
}

interface AppliedArchitectureCounts {
	addedNodes: number;
	updatedNodes: number;
	deletedNodes: number;
	addedEdges: number;
	updatedEdges: number;
	deletedEdges: number;
}

const LIVEBLOCKS_API = "https://api.liveblocks.io/v2/rooms";
const AGENT_ID = "flow-ai-agent";
const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const MIN_POSITION = -10000;
const MAX_POSITION = 10000;
const MIN_SIZE = 40;
const MAX_SIZE = 800;
const MAX_LABEL_LENGTH = 160;
const allowedColors = new Set<string>(
	NODE_COLORS.flatMap((color) => [color.fill, color.text]),
);

export const sharedTriggerQueue = queue({
	name: "flow-ai-design-agent",
	concurrencyLimit: 3,
});

const safeIdSchema = z.string().regex(SAFE_ID_PATTERN);
const canvasColorSchema = z
	.string()
	.regex(HEX_COLOR_PATTERN)
	.refine((value) => allowedColors.has(value));
const nodeShapeSchema = z.enum(NODE_SHAPES);
const optionalSanitizedStringSchema = z.string().max(4000).optional();

const addedNodeSchema = z
	.object({
		id: safeIdSchema,
		label: z.string().max(4000),
		shape: nodeShapeSchema,
		color: canvasColorSchema,
		textColor: canvasColorSchema,
		x: z.number(),
		y: z.number(),
		width: z.number(),
		height: z.number(),
	})
	.strict();

const updatedNodeSchema = z
	.object({
		id: safeIdSchema,
		label: optionalSanitizedStringSchema,
		shape: nodeShapeSchema.optional(),
		color: canvasColorSchema.optional(),
		textColor: canvasColorSchema.optional(),
		x: z.number().optional(),
		y: z.number().optional(),
		width: z.number().optional(),
		height: z.number().optional(),
	})
	.strict();

const addedEdgeSchema = z
	.object({
		id: safeIdSchema,
		source: safeIdSchema,
		target: safeIdSchema,
		label: optionalSanitizedStringSchema,
	})
	.strict();

const updatedEdgeSchema = z
	.object({
		id: safeIdSchema,
		label: optionalSanitizedStringSchema,
	})
	.strict();

const generatedArchitectureSchema = z
	.object({
		addedNodes: z.array(addedNodeSchema).default([]),
		updatedNodes: z.array(updatedNodeSchema).default([]),
		deletedNodeIds: z.array(safeIdSchema).default([]),
		addedEdges: z.array(addedEdgeSchema).default([]),
		updatedEdges: z.array(updatedEdgeSchema).default([]),
		deletedEdgeIds: z.array(safeIdSchema).default([]),
	})
	.strict();

export const designAgentTask = task({
	id: "design-agent",
	queue: sharedTriggerQueue,
	maxDuration: 300,
	run: async (payload: DesignAgentPayload) => {
		const { prompt, roomId } = payload;
		const liveblocksSecret = serverEnv.LIVEBLOCKS_SECRET_KEY;

		metadata.set("statusMessage", "Starting AI Architect...");

		async function setPresence(
			isThinking: boolean,
			statusMsg: string,
			ttl: number = 30,
		) {
			metadata.set("statusMessage", statusMsg);

			try {
				await liveblocksRequest(`${LIVEBLOCKS_API}/${roomId}/presence`, {
					method: "POST",
					headers: liveblocksHeaders(liveblocksSecret),
					body: JSON.stringify({
						userId: AGENT_ID,
						data: { isThinking, cursor: null },
						userInfo: {
							displayName: "Flow AI",
							avatarUrl: "https://api.dicebear.com/9.x/bottts/svg?seed=FlowAI",
							cursorColor: "#6457f9",
						},
						ttl,
					}),
				});
			} catch (err) {
				console.error("Failed to set presence", err);
			}

			try {
				await liveblocksRequest(`${LIVEBLOCKS_API}/${roomId}/broadcast_event`, {
					method: "POST",
					headers: liveblocksHeaders(liveblocksSecret),
					body: JSON.stringify({
						type: "ai-status-feed",
						payload: {
							text: isThinking ? statusMsg : undefined,
							timestamp: new Date().toISOString(),
						},
					}),
				});
			} catch (err) {
				console.error("Failed to broadcast ai-status-feed event", err);
			}
		}

		await setPresence(true, "Analyzing current architecture...", 60);

		const liveblocks = new Liveblocks({ secret: liveblocksSecret });
		let currentStorage: Record<string, unknown> | null = null;
		try {
			currentStorage = (await liveblocks.getStorageDocument(
				roomId,
				"json",
			)) as Record<string, unknown>;
		} catch (error) {
			console.error("Could not fetch storage, might be empty", error);
		}

		const flow = currentStorage?.flow as Record<string, unknown> | undefined;
		const currentNodes = flow?.nodes
			? Object.values(flow.nodes as Record<string, unknown>)
			: [];
		const currentEdges = flow?.edges
			? Object.values(flow.edges as Record<string, unknown>)
			: [];

		await setPresence(true, "Designing new system components...", 60);

		const google = createGoogleGenerativeAI({
			apiKey: serverEnv.GOOGLE_AI_API_KEY,
		});

		const result = await generateText({
			model: google("gemini-2.5-flash"),
			system: `You are Flow AI, an expert software architect.
The user wants to generate or modify a system architecture diagram.
Current Canvas State:
Nodes: ${JSON.stringify(currentNodes, null, 2)}
Edges: ${JSON.stringify(currentEdges, null, 2)}

Instructions:
1. Interpret the user's prompt and generate the required nodes and edges modifications.
2. Provide new nodes with suitable shapes (e.g., 'cylinder' for databases, 'rectangle' for services, 'hexagon' for external).
3. Ensure new coordinates (x, y) are spaced out properly so nodes don't overlap. Usually space them by 200-300px.
4. Use matching dark-theme color pairs for color/textColor. Example pairs:
   - neutral: fill #1F1F1F, text #EDEDED
   - blue: fill #10233D, text #52A8FF
   - purple: fill #2E1938, text #BF7AF0
   - orange: fill #331B00, text #FF990A
   - green: fill #0F2E18, text #62C073
5. Apply actions like adding, moving, resizing, updating, and deleting nodes and edges to reflect the user's design.
You MUST reply with a JSON object that matches the following schema:
{
  "addedNodes": [
    {
      "id": "string",
      "label": "string",
      "shape": "rectangle" | "diamond" | "circle" | "pill" | "cylinder" | "hexagon",
      "color": "string",
      "textColor": "string",
      "x": "number",
      "y": "number",
      "width": "number",
      "height": "number"
    }
  ],
  "updatedNodes": [
    {
      "id": "string (the existing node id to update)",
      "label": "string (optional)",
      "shape": "string (optional)",
      "color": "string (optional)",
      "textColor": "string (optional)",
      "x": "number (optional)",
      "y": "number (optional)",
      "width": "number (optional)",
      "height": "number (optional)"
    }
  ],
  "deletedNodeIds": ["string"],
  "addedEdges": [
    {
      "id": "string",
      "source": "string",
      "target": "string",
      "label": "string"
    }
  ],
  "updatedEdges": [
    {
      "id": "string (the existing edge id to update)",
      "label": "string (optional)"
    }
  ],
  "deletedEdgeIds": ["string"]
}`,
			prompt,
		});

		const generatedArchitecture = parseGeneratedArchitecture(result.text);

		await setPresence(true, "Applying changes to canvas...", 60);

		const appliedCounts = await applyGeneratedArchitecture(
			liveblocks,
			roomId,
			generatedArchitecture,
		);

		await setPresence(false, "Done", 2);
		metadata.set("statusMessage", "Generation complete.");

		return {
			status: "completed",
			...appliedCounts,
		};
	},
});

function parseGeneratedArchitecture(rawText: string): GeneratedArchitecture {
	const match = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
	const jsonString = match ? match[1] : rawText;
	let parsed: unknown;

	try {
		parsed = JSON.parse(jsonString);
	} catch (parseErr) {
		throw new Error("Failed to parse AI architecture JSON output.", {
			cause: parseErr,
		});
	}

	const result = generatedArchitectureSchema.safeParse(parsed);
	if (!result.success) {
		throw new Error(
			`AI architecture output failed validation: ${result.error.message}`,
		);
	}

	return {
		addedNodes: result.data.addedNodes.map(sanitizeAddedNode),
		updatedNodes: result.data.updatedNodes.map(sanitizeUpdatedNode),
		deletedNodeIds: result.data.deletedNodeIds,
		addedEdges: result.data.addedEdges.map(sanitizeAddedEdge),
		updatedEdges: result.data.updatedEdges.map(sanitizeUpdatedEdge),
		deletedEdgeIds: result.data.deletedEdgeIds,
	};
}

function sanitizeAddedNode(
	node: z.infer<typeof addedNodeSchema>,
): SanitizedAddedNode {
	const shape = node.shape;
	const defaultSize = SHAPE_DEFAULT_SIZES[shape];

	return {
		id: node.id,
		label: sanitizeLabel(node.label),
		shape,
		color: node.color,
		textColor: node.textColor,
		x: clampNumber(node.x, MIN_POSITION, MAX_POSITION),
		y: clampNumber(node.y, MIN_POSITION, MAX_POSITION),
		width: clampNumber(node.width, MIN_SIZE, MAX_SIZE, defaultSize.width),
		height: clampNumber(node.height, MIN_SIZE, MAX_SIZE, defaultSize.height),
	};
}

function sanitizeUpdatedNode(
	node: z.infer<typeof updatedNodeSchema>,
): SanitizedUpdatedNode {
	return {
		id: node.id,
		...(node.label !== undefined ? { label: sanitizeLabel(node.label) } : {}),
		...(node.shape !== undefined ? { shape: node.shape } : {}),
		...(node.color !== undefined ? { color: node.color } : {}),
		...(node.textColor !== undefined ? { textColor: node.textColor } : {}),
		...(node.x !== undefined
			? { x: clampNumber(node.x, MIN_POSITION, MAX_POSITION) }
			: {}),
		...(node.y !== undefined
			? { y: clampNumber(node.y, MIN_POSITION, MAX_POSITION) }
			: {}),
		...(node.width !== undefined
			? { width: clampNumber(node.width, MIN_SIZE, MAX_SIZE) }
			: {}),
		...(node.height !== undefined
			? { height: clampNumber(node.height, MIN_SIZE, MAX_SIZE) }
			: {}),
	};
}

function sanitizeAddedEdge(
	edge: z.infer<typeof addedEdgeSchema>,
): SanitizedAddedEdge {
	return {
		id: edge.id,
		source: edge.source,
		target: edge.target,
		...(edge.label !== undefined ? { label: sanitizeLabel(edge.label) } : {}),
	};
}

function sanitizeUpdatedEdge(
	edge: z.infer<typeof updatedEdgeSchema>,
): SanitizedUpdatedEdge {
	return {
		id: edge.id,
		...(edge.label !== undefined ? { label: sanitizeLabel(edge.label) } : {}),
	};
}

async function applyGeneratedArchitecture(
	liveblocks: Liveblocks,
	roomId: string,
	generatedArchitecture: GeneratedArchitecture,
): Promise<AppliedArchitectureCounts> {
	const appliedCounts: AppliedArchitectureCounts = {
		addedNodes: 0,
		updatedNodes: 0,
		deletedNodes: 0,
		addedEdges: 0,
		updatedEdges: 0,
		deletedEdges: 0,
	};

	await mutateFlow<CanvasNode, CanvasEdge>(
		{ client: liveblocks, roomId },
		(flow) => {
			for (const node of generatedArchitecture.addedNodes) {
				if (flow.getNode(node.id)) continue;

				flow.addNode({
					id: node.id,
					type: CANVAS_NODE_TYPE,
					position: { x: node.x, y: node.y },
					width: node.width,
					height: node.height,
					data: {
						label: node.label,
						shape: node.shape,
						color: node.color,
						textColor: node.textColor,
					},
					style: { width: node.width, height: node.height },
				});
				appliedCounts.addedNodes += 1;
			}

			for (const node of generatedArchitecture.updatedNodes) {
				const existingNode = flow.getNode(node.id);
				if (!existingNode) continue;

				const nextNode: CanvasNode = {
					...existingNode,
					position: {
						x: node.x ?? existingNode.position.x,
						y: node.y ?? existingNode.position.y,
					},
					width: node.width ?? existingNode.width,
					height: node.height ?? existingNode.height,
					data: {
						...existingNode.data,
						...(node.label !== undefined ? { label: node.label } : {}),
						...(node.shape !== undefined ? { shape: node.shape } : {}),
						...(node.color !== undefined ? { color: node.color } : {}),
						...(node.textColor !== undefined
							? { textColor: node.textColor }
							: {}),
					},
					style: {
						...existingNode.style,
						width: node.width ?? existingNode.width,
						height: node.height ?? existingNode.height,
					},
				};

				flow.updateNode(node.id, nextNode);
				appliedCounts.updatedNodes += 1;
			}

			for (const id of generatedArchitecture.deletedNodeIds) {
				if (!flow.getNode(id)) continue;
				flow.removeNode(id);
				appliedCounts.deletedNodes += 1;
			}

			for (const edge of generatedArchitecture.addedEdges) {
				if (flow.getEdge(edge.id)) continue;

				flow.addEdge({
					id: edge.id,
					type: CANVAS_EDGE_TYPE,
					source: edge.source,
					target: edge.target,
					data: {
						label: edge.label || "",
					},
				});
				appliedCounts.addedEdges += 1;
			}

			for (const edge of generatedArchitecture.updatedEdges) {
				const existingEdge = flow.getEdge(edge.id);
				if (!existingEdge || edge.label === undefined) continue;

				flow.updateEdge(edge.id, {
					...existingEdge,
					data: {
						...existingEdge.data,
						label: edge.label,
					},
				});
				appliedCounts.updatedEdges += 1;
			}

			for (const id of generatedArchitecture.deletedEdgeIds) {
				if (!flow.getEdge(id)) continue;
				flow.removeEdge(id);
				appliedCounts.deletedEdges += 1;
			}
		},
	);

	return appliedCounts;
}

function liveblocksHeaders(secret: string): HeadersInit {
	return {
		Authorization: `Bearer ${secret}`,
		"Content-Type": "application/json",
	};
}

async function liveblocksRequest(
	url: string,
	init: RequestInit,
): Promise<Response> {
	const response = await retry.fetch(url, init);

	if (!response.ok) {
		const body = await response.text();
		throw new Error(
			`Liveblocks request failed with ${response.status}: ${body}`,
		);
	}

	return response;
}

function sanitizeLabel(value: string): string {
	return value
		.replace(/[\u0000-\u001F\u007F]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, MAX_LABEL_LENGTH);
}

function clampNumber(
	value: number,
	min: number,
	max: number,
	fallback: number = min,
): number {
	if (!Number.isFinite(value)) return fallback;
	return Math.min(Math.max(value, min), max);
}

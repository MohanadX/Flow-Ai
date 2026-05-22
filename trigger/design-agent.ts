import { metadata, task } from "@trigger.dev/sdk/v3";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { Liveblocks } from "@liveblocks/node";

export interface DesignAgentPayload {
	prompt: string;
	roomId: string;
}

const LIVEBLOCKS_API = "https://api.liveblocks.io/v2/rooms";
const AGENT_ID = "flow-ai-agent";

interface GeneratedArchitecture {
	addedNodes?: {
		id: string;
		label: string;
		shape: string;
		color: string;
		textColor: string;
		x: number;
		y: number;
		width: number;
		height: number;
	}[];
	updatedNodes?: {
		id: string;
		label?: string;
		shape?: string;
		color?: string;
		textColor?: string;
		x?: number;
		y?: number;
		width?: number;
		height?: number;
	}[];
	deletedNodeIds?: string[];
	addedEdges?: {
		id: string;
		source: string;
		target: string;
		label?: string;
	}[];
	updatedEdges?: {
		id: string;
		label?: string;
	}[];
	deletedEdgeIds?: string[];
}

export const designAgentTask = task({
	id: "design-agent",
	maxDuration: 300,
	run: async (payload: DesignAgentPayload) => {
		const { prompt, roomId } = payload;
		const secret = process.env.LIVEBLOCKS_SECRET_KEY!;

		console.log(
			`[design-agent] starting for room ${roomId} with prompt: "${prompt}"`,
		);
		metadata.set("statusMessage", "Starting AI Architect...");

		/**
		 *ttl: time to live. the task must start in this time otherwise it is expired
		 * @param isThinking - boolean indicating if the AI is thinking
		 * @param statusMsg - string indicating the status message
		 * @param ttl - number indicating the time to live
		 * @purpose set the AI process current state
		 */
		async function setPresence(
			isThinking: boolean,
			statusMsg: string,
			ttl: number = 30,
		) {
			metadata.set("statusMessage", statusMsg);
			try {
				await fetch(`${LIVEBLOCKS_API}/${roomId}/presence`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${secret}`,
						"Content-Type": "application/json",
					},
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

			// Broadcast the status to the ai-status-feed so every participant
			// sees the latest generation state regardless of their own presence.
			try {
				await fetch(`${LIVEBLOCKS_API}/${roomId}/events`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${secret}`,
						"Content-Type": "application/json",
					},
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

		// Fetch current canvas state
		const liveblocks = new Liveblocks({ secret });
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
			apiKey: process.env.GOOGLE_AI_API_KEY!,
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
			prompt: prompt,
		});

		let generatedArchitecture: GeneratedArchitecture = {
			addedNodes: [],
			updatedNodes: [],
			deletedNodeIds: [],
			addedEdges: [],
			updatedEdges: [],
			deletedEdgeIds: [],
		};
		try {
			// Find JSON content inside the text (e.g., if there are markdown code blocks)
			const match = result.text.match(/```json\n([\s\S]*?)\n```/);
			const jsonString = match ? match[1] : result.text;
			generatedArchitecture = JSON.parse(jsonString);
		} catch (parseErr) {
			console.error("Failed to parse AI output:", parseErr);
		}

		await setPresence(true, "Applying changes to canvas...", 60);

		const ops: Record<string, unknown>[] = [];

		for (const node of generatedArchitecture.addedNodes || []) {
			// Ensure path exists
			ops.push({
				op: "add",
				path: `/flow/nodes/${node.id}`,
				value: {
					id: node.id,
					type: "canvasNode",
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
				},
			});
		}

		for (const node of generatedArchitecture.updatedNodes || []) {
			const { id, x, y, width, height, label, shape, color, textColor } = node;
			if (x !== undefined) ops.push({ op: "replace", path: `/flow/nodes/${id}/position/x`, value: x });
			if (y !== undefined) ops.push({ op: "replace", path: `/flow/nodes/${id}/position/y`, value: y });
			if (width !== undefined) {
				ops.push({ op: "replace", path: `/flow/nodes/${id}/width`, value: width });
				ops.push({ op: "replace", path: `/flow/nodes/${id}/style/width`, value: width });
			}
			if (height !== undefined) {
				ops.push({ op: "replace", path: `/flow/nodes/${id}/height`, value: height });
				ops.push({ op: "replace", path: `/flow/nodes/${id}/style/height`, value: height });
			}
			if (label !== undefined) ops.push({ op: "replace", path: `/flow/nodes/${id}/data/label`, value: label });
			if (shape !== undefined) ops.push({ op: "replace", path: `/flow/nodes/${id}/data/shape`, value: shape });
			if (color !== undefined) ops.push({ op: "replace", path: `/flow/nodes/${id}/data/color`, value: color });
			if (textColor !== undefined) ops.push({ op: "replace", path: `/flow/nodes/${id}/data/textColor`, value: textColor });
		}

		for (const id of generatedArchitecture.deletedNodeIds || []) {
			ops.push({ op: "remove", path: `/flow/nodes/${id}` });
		}

		for (const edge of generatedArchitecture.addedEdges || []) {
			ops.push({
				op: "add",
				path: `/flow/edges/${edge.id}`,
				value: {
					id: edge.id,
					type: "canvasEdge",
					source: edge.source,
					target: edge.target,
					data: {
						label: edge.label || "",
					},
				},
			});
		}

		for (const edge of generatedArchitecture.updatedEdges || []) {
			if (edge.label !== undefined) {
				ops.push({ op: "replace", path: `/flow/edges/${edge.id}/data/label`, value: edge.label });
			}
		}

		for (const id of generatedArchitecture.deletedEdgeIds || []) {
			ops.push({ op: "remove", path: `/flow/edges/${id}` });
		}

		if (ops.length > 0) {
			try {
				const res = await fetch(
					`${LIVEBLOCKS_API}/${roomId}/storage/json-patch`,
					{
						method: "PATCH",
						headers: {
							Authorization: `Bearer ${secret}`,
							"Content-Type": "application/json",
						},
						body: JSON.stringify(ops),
					},
				);

				if (!res.ok) {
					const errBody = await res.text();
					console.error("JSON Patch failed:", res.status, errBody);
					// If /flow doesn't exist yet, we might need to initialize it
					if (res.status === 422 && errBody.includes("missing")) {
						console.log("Attempting to initialize /flow object...");
						const initOps = [
							{ op: "add", path: "/flow", value: { nodes: {}, edges: {} } },
							...ops,
						];
						await fetch(`${LIVEBLOCKS_API}/${roomId}/storage/json-patch`, {
							method: "PATCH",
							headers: {
								Authorization: `Bearer ${secret}`,
								"Content-Type": "application/json",
							},
							body: JSON.stringify(initOps),
						});
					}
				}
			} catch (patchErr) {
				console.error("Error applying JSON patch", patchErr);
			}
		}

		// Clear presence by setting TTL to a very small value, and isThinking to false
		await setPresence(false, "Done", 2);
		metadata.set("statusMessage", "Generation complete.");

		return {
			status: "completed",
			addedNodes: generatedArchitecture.addedNodes?.length || 0,
			updatedNodes: generatedArchitecture.updatedNodes?.length || 0,
			deletedNodes: generatedArchitecture.deletedNodeIds?.length || 0,
			addedEdges: generatedArchitecture.addedEdges?.length || 0,
			updatedEdges: generatedArchitecture.updatedEdges?.length || 0,
			deletedEdges: generatedArchitecture.deletedEdgeIds?.length || 0,
		};
	},
});

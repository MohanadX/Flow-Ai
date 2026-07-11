import { metadata, queue, schemaTask } from "@trigger.dev/sdk";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

import { serverEnv } from "@/env/server";
import {
	generateSpecPayloadSchema,
	type GenerateSpecPayload,
} from "@/types/spec-generation";
import { saveGeneratedSpec } from "@/lib/spec-service";

export const specGenerationQueue = queue({
	name: "flow-ai-spec-generation",
	concurrencyLimit: 3,
});

export const generateSpec = schemaTask({
	id: "generate-spec",
	queue: specGenerationQueue,
	schema: generateSpecPayloadSchema,
	maxDuration: 300,
	run: async (payload) => {
		if (payload.projectId !== payload.roomId) {
			throw new Error(
				"Spec generation requires projectId and roomId to match.",
			);
		}

		metadata.set("statusMessage", "Preparing canvas context...");
		metadata.set("phase", "preparing");

		const google = createGoogleGenerativeAI({
			apiKey: serverEnv.GOOGLE_AI_API_KEY,
		});

		const canvasSummary = buildCanvasSummary(payload.nodes, payload.edges);
		const chatSummary = buildChatSummary(payload.chatHistory);

		metadata.set("statusMessage", "Generating technical specification...");
		metadata.set("phase", "generating");

		const result = await generateText({
			model: google("gemini-2.5-flash"),
			system: `You are Flow AI, an expert software architect.
Generate a clear Markdown technical specification from the supplied collaborative system design canvas and AI chat context.

Requirements:
- Return only Markdown content, with no surrounding code fence.
- Start with a level-one title.
- Include sections for overview, goals, architecture, components, data/storage, external integrations, key flows, operational concerns, and open questions.
- Ground the spec in the provided nodes, edges, labels, shapes, and chat history.
- Do not invent implementation details that are not implied by the canvas or chat. Use open questions where details are missing.
- Keep the writing concise, technical, and implementation-ready.`,
			prompt: `Project ID: ${payload.projectId}
Room ID: ${payload.roomId}

Canvas:
${canvasSummary}

Chat Context:
${chatSummary}`,
		});

		const specMarkdown = normalizeMarkdown(result.text);

		if (!specMarkdown) {
			throw new Error("Spec generation returned empty Markdown.");
		}

		metadata.set("statusMessage", "Saving generated spec...");
		metadata.set("phase", "saving");

		const savedSpec = await saveGeneratedSpec(payload.projectId, specMarkdown);

		metadata.set("statusMessage", "Spec generation complete.");
		metadata.set("phase", "completed");
		metadata.set("specId", savedSpec.spec.id);
		metadata.set("nodeCount", payload.nodes.length);
		metadata.set("edgeCount", payload.edges.length);

		return {
			specId: savedSpec.spec.id,
			content: savedSpec.content,
		};
	},
});

function buildCanvasSummary(
	nodes: GenerateSpecPayload["nodes"],
	edges: GenerateSpecPayload["edges"],
): string {
	const nodeLines = nodes.map((node) => {
		const label = normalizeInlineText(node.data?.label || "Untitled");
		const shape = node.data?.shape ? `, shape: ${node.data.shape}` : "";
		const size =
			node.width && node.height ? `, size: ${node.width}x${node.height}` : "";
		const position = node.position
			? `, position: (${node.position.x}, ${node.position.y})`
			: "";

		return `- Node ${node.id}: ${label}${shape}${size}${position}`;
	});

	const edgeLines = edges.map((edge) => {
		const label = edge.data?.label
			? ` (${normalizeInlineText(edge.data.label)})`
			: "";

		return `- Edge ${edge.id}: ${edge.source} -> ${edge.target}${label}`;
	});

	return [
		"Nodes:",
		nodeLines.length > 0 ? nodeLines.join("\n") : "- None",
		"",
		"Edges:",
		edgeLines.length > 0 ? edgeLines.join("\n") : "- None",
	].join("\n");
}

function buildChatSummary(
	chatHistory: GenerateSpecPayload["chatHistory"],
): string {
	if (chatHistory.length === 0) {
		return "- No chat history provided.";
	}

	return chatHistory
		.map((message) => {
			const author =
				message.role ||
				(message.sender ? normalizeInlineText(message.sender.name) : "unknown");
			const timestamp = message.timestamp ? ` [${message.timestamp}]` : "";

			return `- ${author}${timestamp}: ${normalizeInlineText(message.content)}`;
		})
		.join("\n");
}

function normalizeMarkdown(value: string): string {
	const trimmed = value.trim();
	const match = trimmed.match(/^```(?:markdown|md)?\s*([\s\S]*?)\s*```$/i);
	return (match?.[1] ?? trimmed).trim();
}

function normalizeInlineText(value: string): string {
	return value
		.replace(/[\u0000-\u001F\u007F]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

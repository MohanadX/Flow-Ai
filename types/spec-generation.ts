import { z } from "zod";

import { NODE_SHAPES } from "@/types/canvas";

const MAX_CHAT_MESSAGES = 100;
const MAX_NODES = 500;
const MAX_EDGES = 1000;

export const specChatMessageSchema = z
	.object({
		role: z.enum(["user", "assistant"]).optional(),
		content: z.string().trim().min(1).max(4000),
		timestamp: z.string().optional(),
		sender: z
			.object({
				id: z.string().min(1).max(200),
				name: z.string().min(1).max(200),
				avatarUrl: z.string().optional(),
			})
			.optional(),
	})
	.passthrough();

export const specCanvasNodeSchema = z
	.object({
		id: z.string().min(1).max(128),
		type: z.string().optional(),
		position: z
			.object({
				x: z.number(),
				y: z.number(),
			})
			.optional(),
		width: z.number().optional(),
		height: z.number().optional(),
		data: z
			.object({
				label: z.string().max(4000).optional(),
				color: z.string().optional(),
				textColor: z.string().optional(),
				shape: z.enum(NODE_SHAPES).optional(),
			})
			.passthrough()
			.optional(),
	})
	.passthrough();

export const specCanvasEdgeSchema = z
	.object({
		id: z.string().min(1).max(128),
		type: z.string().optional(),
		source: z.string().min(1).max(128),
		target: z.string().min(1).max(128),
		data: z
			.object({
				label: z.string().max(4000).optional(),
			})
			.passthrough()
			.optional(),
	})
	.passthrough();

export const generateSpecPayloadSchema = z
	.object({
		projectId: z.string().trim().min(1).max(200),
		roomId: z.string().trim().min(1).max(200),
		chatHistory: z.array(specChatMessageSchema).max(MAX_CHAT_MESSAGES),
		nodes: z.array(specCanvasNodeSchema).max(MAX_NODES),
		edges: z.array(specCanvasEdgeSchema).max(MAX_EDGES),
	})
	.strict();

export const generateSpecRequestSchema = generateSpecPayloadSchema.omit({
	projectId: true,
});

export type GenerateSpecPayload = z.infer<typeof generateSpecPayloadSchema>;
export type GenerateSpecRequest = z.infer<typeof generateSpecRequestSchema>;

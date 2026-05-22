import { z } from "zod";

export const AI_CHAT_FEED_ID = "ai-chat";

export const aiChatSenderSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	avatarUrl: z.string().optional(),
});

export const aiChatMessageSchema = z.object({
	sender: aiChatSenderSchema,
	role: z.enum(["user", "assistant"]),
	content: z.string().trim().min(1).max(4000),
	timestamp: z.string().min(1),
});

export const aiChatFeedMetadataSchema = z.object({
	kind: z.literal(AI_CHAT_FEED_ID),
});

export type AiChatSender = z.infer<typeof aiChatSenderSchema>;
export type AiChatMessageData = z.infer<typeof aiChatMessageSchema>;
export type AiChatFeedMetadata = z.infer<typeof aiChatFeedMetadataSchema>;

export function isAiChatMessageData(
	value: unknown,
): value is AiChatMessageData {
	return aiChatMessageSchema.safeParse(value).success;
}

/**
 * Payload schema for messages published to the "ai-status-feed" RoomEvent.
 * Kept generic enough to serve both design-agent and future spec-generation flows.
 */
export interface AiStatusPayload {
	/** Human-readable status text shown in the sidebar. Optional — omit to clear. */
	text?: string;
	/** ISO-8601 timestamp set by the sender. */
	timestamp: string;
}

/**
 * Validate that an unknown value conforms to {@link AiStatusPayload}.
 * Used in the sidebar before displaying any feed message.
 */
export function isAiStatusPayload(value: unknown): value is AiStatusPayload {
	if (typeof value !== "object" || value === null) return false;

	const candidate = value as Record<string, unknown>;

	if (typeof candidate.timestamp !== "string") return false;
	if (candidate.text !== undefined && typeof candidate.text !== "string")
		return false;

	return true;
}

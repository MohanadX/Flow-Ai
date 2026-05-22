import type {
	AiChatFeedMetadata,
	AiChatMessageData,
} from "@/types/tasks";

declare global {
	interface Liveblocks {
		Presence: {
			cursor: { x: number; y: number } | null;
			isThinking: boolean;
		};

		UserMeta: {
			id: string;
			info: {
				displayName: string;
				avatarUrl: string;
				cursorColor: string;
			};
		};

		Storage: Record<string, never>;

		/**
		 * Broadcast events for the room.
		 * The `ai-status-feed` kind carries the latest AI generation status
		 * visible to every participant.
		 */
		RoomEvent: {
			type: "ai-status-feed";
			payload: {
				/** Human-readable status text. Omit to signal generation ended. */
				text?: string;
				/** ISO-8601 timestamp set by the sender. */
				timestamp: string;
			};
		};

		FeedMetadata: AiChatFeedMetadata;
		FeedMessageData: AiChatMessageData;

		ThreadMetadata: Record<string, never>;
		RoomInfo: Record<string, never>;
		GroupInfo: Record<string, never>;
		ActivitiesData: Record<string, never>;
	}
}

export {};
// Augmentations for the global scope can only be directly nested in external modules or ambient module declarations.

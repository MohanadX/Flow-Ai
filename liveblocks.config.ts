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
		RoomEvent: Record<string, never>;
		ThreadMetadata: Record<string, never>;
		RoomInfo: Record<string, never>;
		GroupInfo: Record<string, never>;
		ActivitiesData: Record<string, never>;
	}
}

export {};
//Augmentations for the global scope can only be directly nested in external modules or ambient module declarations.

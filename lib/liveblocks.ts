import "server-only";

import { Liveblocks } from "@liveblocks/node";

const CURSOR_COLORS = [
	"#00c8d4",
	"#6457f9",
	"#34d399",
	"#fbbf24",
	"#ff4d4f",
	"#8b82ff",
] as const;

const globalForLiveblocks = globalThis as typeof globalThis & {
	liveblocks?: Liveblocks;
};

function createLiveblocksClient(): Liveblocks {
	const secret = process.env.LIVEBLOCKS_SECRET_KEY;

	if (!secret) {
		throw new Error(
			"LIVEBLOCKS_SECRET_KEY is required to initialize Liveblocks.",
		);
	}

	return new Liveblocks({ secret });
}

export function getLiveblocksClient(): Liveblocks {
	const cachedClient = globalForLiveblocks.liveblocks;
	if (cachedClient) return cachedClient;

	const client = createLiveblocksClient();

	if (process.env.NODE_ENV !== "production") {
		globalForLiveblocks.liveblocks = client;
	}

	return client;
}

export function getCursorColorForUser(userId: string): string {
	let hash = 0;

	for (let index = 0; index < userId.length; index += 1) {
		hash = (hash * 31 + userId.charCodeAt(index)) >>> 0;
	}

	// >>> 0 It guarantees:non-negative integer, consistent 32-bit overflow behavior
	return CURSOR_COLORS[hash % CURSOR_COLORS.length];
}

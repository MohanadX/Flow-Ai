import "server-only";

import { clerkClient } from "@clerk/nextjs/server";

interface CachedClerkUser {
	userId: string;
	email: string | null;
	emailAddresses: string[];
	displayName: string;
	avatarUrl: string;
}

interface ClerkUserCacheEntry {
	user: CachedClerkUser;
	expiresAt: number;
}

const clerkUserCache = new Map<string, ClerkUserCacheEntry>();
const pendingClerkUserRequests = new Map<string, Promise<CachedClerkUser>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

export async function getCachedClerkUser(userId: string): Promise<CachedClerkUser> {
	const now = Date.now();
	const cached = clerkUserCache.get(userId);
	if (cached && cached.expiresAt > now) {
		return cached.user;
	}

	const pending = pendingClerkUserRequests.get(userId);
	if (pending) return pending;

	const request = fetchAndCacheClerkUser(userId, now);
	pendingClerkUserRequests.set(userId, request);

	try {
		return await request;
	} finally {
		pendingClerkUserRequests.delete(userId);
	}
}

async function fetchAndCacheClerkUser(
	userId: string,
	requestedAt: number,
): Promise<CachedClerkUser> {
	const client = await clerkClient();
	const user = await client.users.getUser(userId);

	const emailAddresses = user.emailAddresses.map((email) => email.emailAddress);
	const email = emailAddresses[0] ?? null;
	const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
	const displayName = name || user.username || email || "Anonymous";
	const avatarUrl = user.imageUrl ?? "";

	const cachedUser: CachedClerkUser = {
		userId,
		email,
		emailAddresses,
		displayName,
		avatarUrl,
	};

	clerkUserCache.set(userId, {
		user: cachedUser,
		expiresAt: requestedAt + CACHE_TTL_MS,
	});

	return cachedUser;
}

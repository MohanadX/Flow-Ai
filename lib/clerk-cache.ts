import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { ApiError } from "@/lib/api-response";

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

interface PendingClerkUserRequest {
	request: Promise<CachedClerkUser>;
	expiresAt: number;
}

const clerkUserCache = new Map<string, ClerkUserCacheEntry>();
const pendingClerkUserRequests = new Map<string, PendingClerkUserRequest>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL
const CACHE_PRUNE_INTERVAL_MS = 5 * 60 * 1000;
let lastPrunedAt = 0;

export async function getCachedClerkUser(
	userId: string,
): Promise<CachedClerkUser> {
	const now = Date.now();
	pruneExpiredClerkCache(now);

	const cached = clerkUserCache.get(userId);
	if (cached && cached.expiresAt > now) {
		return cached.user;
	}

	const pending = pendingClerkUserRequests.get(userId);
	if (pending && pending.expiresAt > now) return pending.request;

	const request = fetchAndCacheClerkUser(userId, now);
	pendingClerkUserRequests.set(userId, {
		request,
		expiresAt: now + CACHE_TTL_MS,
	});

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
	try {
		const client = await clerkClient();
		const user = await client.users.getUser(userId);

		const emailAddresses = user.emailAddresses.map(
			(email) => email.emailAddress,
		);
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
	} catch (error) {
		console.error("Failed to load Clerk user profile", {
			userId,
			error,
		});
		throw new ApiError(
			502,
			"CLERK_PROFILE_UNAVAILABLE",
			"Unable to load user profile.",
		);
	}
}

function pruneExpiredClerkCache(now: number): void {
	if (now - lastPrunedAt < CACHE_PRUNE_INTERVAL_MS) return; // explain this line

	lastPrunedAt = now;

	for (const [userId, entry] of clerkUserCache) {
		if (entry.expiresAt <= now) {
			clerkUserCache.delete(userId);
		}
	}

	for (const [userId, entry] of pendingClerkUserRequests) {
		if (entry.expiresAt <= now) {
			pendingClerkUserRequests.delete(userId);
		}
	}
}

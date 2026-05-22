# Walkthrough

## Liveblocks Auth Latency

- `lib/clerk-cache.ts` now caches Clerk user profile details in memory for five minutes.
- Concurrent requests for the same Clerk user share one in-flight `users.getUser` call, which reduces duplicate Clerk round trips during room connection bursts.
- `/api/liveblocks-auth` still verifies Clerk auth and project access before issuing a Liveblocks session, but it reads display name, avatar URL, and email from the cached profile helper.
- `lib/project-access.ts` uses the same helper for `getCurrentIdentity`, keeping workspace access checks consistent with room auth.

## AI Chat Feed Loading

- `AiSidebar` creates the `ai-chat` feed only after the Liveblocks room status is `connected`.
- The `useFeedMessages` hook now lives in a `ChatMessages` child component that only renders after feed creation succeeds or the feed already exists.
- The input remains disabled until the feed is ready, preventing chat writes before Liveblocks can accept them.

## Verification

- `npx tsc --noEmit`
- `npm run build`

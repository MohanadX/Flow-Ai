import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const clientEnv = createEnv({
  client: {
    // Pusher (public)
    NEXT_PUBLIC_PUSHER_KEY: z
      .string({ error: "NEXT_PUBLIC_PUSHER_KEY is missing or not loaded" })
      .min(1),
    NEXT_PUBLIC_PUSHER_CLUSTER: z
      .string({ error: "NEXT_PUBLIC_PUSHER_CLUSTER is missing or not loaded" })
      .min(1),

    // Liveblocks (public)
    NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY: z
      .string({ error: "NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY is missing or not loaded" })
      .min(1),

    // Clerk (public)
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z
      .string({
        error: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is missing or not loaded",
      })
      .min(1),
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: z
      .string({
        error: "NEXT_PUBLIC_CLERK_SIGN_IN_URL is missing or not loaded",
      })
      .min(1),
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: z
      .string({
        error: "NEXT_PUBLIC_CLERK_SIGN_UP_URL is missing or not loaded",
      })
      .min(1),
  },

  // Each NEXT_PUBLIC_ var must be explicitly listed here so Next.js
  // can inline the value into the client bundle at build time.
  experimental__runtimeEnv: {
    NEXT_PUBLIC_PUSHER_KEY: process.env.NEXT_PUBLIC_PUSHER_KEY,
    NEXT_PUBLIC_PUSHER_CLUSTER: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
    NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY: process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
  },
});

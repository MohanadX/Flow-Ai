import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const serverEnv = createEnv({
  server: {
    // AI
    GOOGLE_AI_API_KEY: z
      .string({ error: "GOOGLE_AI_API_KEY is missing or not loaded" })
      .min(1),

    // Trigger.dev
    TRIGGER_SECRET_KEY: z
      .string({ error: "TRIGGER_SECRET_KEY is missing or not loaded" })
      .min(1),
    TRIGGER_PROJECT_REF: z
      .string({ error: "TRIGGER_PROJECT_REF is missing or not loaded" })
      .min(1),

    // Vercel Blob
    BLOB_READ_WRITE_TOKEN: z
      .string({ error: "BLOB_READ_WRITE_TOKEN is missing or not loaded" })
      .min(1),

    // Pusher (server-only)
    PUSHER_SECRET: z
      .string({ error: "PUSHER_SECRET is missing or not loaded" })
      .min(1),
    PUSHER_APP_ID: z
      .string({ error: "PUSHER_APP_ID is missing or not loaded" })
      .min(1),

    // Liveblocks
    LIVEBLOCKS_SECRET_KEY: z
      .string({ error: "LIVEBLOCKS_SECRET_KEY is missing or not loaded" })
      .min(1),

    // Database
    DATABASE_URL: z
      .string({ error: "DATABASE_URL is missing or not loaded" })
      .url({ message: "DATABASE_URL must be a valid URL" }),

    // Clerk (server-only)
    CLERK_SECRET_KEY: z
      .string({ error: "CLERK_SECRET_KEY is missing or not loaded" })
      .min(1),
  },

  // Tell t3-env how to read vars in this runtime
  experimental__runtimeEnv: process.env,
});

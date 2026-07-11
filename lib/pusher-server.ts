// src/lib/pusherServer.js
import { clientEnv } from "@/env/client";
import { serverEnv } from "@/env/server";
import Pusher from "pusher";

export const pusherServer = new Pusher({
  appId: serverEnv.PUSHER_APP_ID,
  key: clientEnv.NEXT_PUBLIC_PUSHER_KEY,
  secret: serverEnv.PUSHER_SECRET,
  cluster: clientEnv.NEXT_PUBLIC_PUSHER_CLUSTER,
  useTLS: true,
});
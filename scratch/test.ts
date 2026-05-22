import { useFeedMessages } from "@liveblocks/react";

// This will help us inspect the parameters and type of useFeedMessages
type P = Parameters<typeof useFeedMessages>;
type R = ReturnType<typeof useFeedMessages>;

console.log("Types loaded successfully");

import { defineConfig } from "@trigger.dev/sdk/v3";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

export default defineConfig({
	project: process.env.TRIGGER_PROJECT_REF!,
	runtime: "node",
	machine: "small-1x",
	maxDuration: 3600, // 1h max
	retries: {
		enabledInDev: false,
		default: {
			maxAttempts: 3,
			minTimeoutInMs: 1000,
			maxTimeoutInMs: 10000,
			factor: 2,
			randomize: true,
		},
	},
	dirs: ["./trigger"],
	build: {
		extensions: [
			prismaExtension({
				mode: "modern",
			}),
		],
	},
});
